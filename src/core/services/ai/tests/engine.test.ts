import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionType } from "../../../../shared/action-type";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import type { Profile } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import {
  registerProvider,
  unregisterProvider,
} from "../../../providers";
import type { StorageAdapter } from "../../../storage";
import { AssignmentsEngine } from "../../assignments";
import { ThreadsEngine } from "../../threads";
import { AIEngine } from "../engine";

const sendMessageMock = vi.fn();
const sendMessageSyncMock = vi.fn();

class StubProvider extends AbstractBaseProvider {
  async *sendMessage(args: unknown): AsyncGenerator<SendMessageResult> {
    yield* sendMessageMock(args);
  }
  async sendMessageSync(args: unknown): Promise<string> {
    return sendMessageSyncMock(args);
  }
  static getName(): string {
    return "Stub";
  }
  static getBaseUrl(): string {
    return "https://stub";
  }
  static async checkProvider(): Promise<boolean> {
    return true;
  }
  static async getProviderModels(): Promise<[]> {
    return [];
  }
}

const STUB = "ai-engine-stub";

const profile: Profile = {
  id: "p1",
  name: "P",
  providerType: STUB,
  baseUrl: "https://stub",
  modelId: "m",
  capabilities: 0xff,
};

const userMessage: ThreadMessageLike = {
  role: "user",
  content: [{ type: "text", text: "hi" }],
};

function makeStorage() {
  let messages: ThreadMessageLike[] = [];
  let threads: { threadId: string; title: string }[] = [];
  const storage = {
    profiles: { readById: vi.fn(async () => profile) },
    assignments: {
      readByType: vi.fn(async () => "p1"),
      readAll: vi.fn(async () => ({})),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    threads: {
      create: vi.fn(async (title: string, profileId?: string) => {
        const thread = {
          threadId: crypto.randomUUID(),
          title,
          profileId,
          lastEditDate: Date.now(),
        };
        threads.push(thread);
        return thread;
      }),
      readAll: vi.fn(async () => [...threads]),
      update: vi.fn(),
      touch: vi.fn(),
      delete: vi.fn(),
    },
    messages: {
      create: vi.fn(
        async (
          _t: string,
          m: Omit<ThreadMessageLike, "id" | "createdAt">
        ): Promise<ThreadMessageLike> => {
          const stored: ThreadMessageLike = {
            ...m,
            id: crypto.randomUUID(),
            createdAt: new Date(Date.now()),
          };
          messages.push(stored);
          return stored;
        }
      ),
      readByThread: vi.fn(async () => [...messages]),
      deleteByThread: vi.fn(async () => {
        messages = [];
      }),
    },
  } as unknown as StorageAdapter;
  return { storage, get messages() { return messages; }, get threads() { return threads; } };
}

beforeEach(() => {
  registerProvider(STUB, StubProvider);
  sendMessageMock.mockReset();
  sendMessageSyncMock.mockReset();
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "00000000-0000-0000-0000-000000000001"
  );
  vi.spyOn(Date, "now").mockReturnValue(1000);
});

afterEach(() => {
  unregisterProvider(STUB);
  vi.restoreAllMocks();
});

async function* arrayToStream(items: SendMessageResult[]) {
  for (const it of items) yield it;
}

describe("AIEngine.sendWithStream", () => {
  it("creates thread, persists user msg + assistant reply, yields stream events", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("My Title");
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: final }])
    );
    const { storage, threads, messages } = makeStorage();
    const engine = new AIEngine({ storage });
    const yielded = [];
    for await (const item of engine.sendWithStream({ userMessage })) {
      yielded.push(item);
    }
    expect(yielded).toHaveLength(1);
    expect(yielded[0].title).toBe("My Title");
    expect(threads).toHaveLength(1);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining(userMessage),
        expect.objectContaining(final),
      ])
    );
  });

  it("uses an injected ThreadsEngine when provided", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Hello");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const threads = new ThreadsEngine({ storage });
    const assignments = new AssignmentsEngine({ storage });
    const engine = new AIEngine({ storage, threads, assignments });
    for await (const _ of engine.sendWithStream({ userMessage })) {
      // drain
    }
    // verify the provided sub-engines actually got used by checking storage.threads.create was hit
    expect(storage.threads.create).toHaveBeenCalled();
  });
});

describe("AIEngine.send", () => {
  it("Chat dispatches via the streaming chat action and drains it", async () => {
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "final" }],
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: final }])
    );
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const result = await engine.send({
      actionType: ActionType.Chat,
      userMessage,
    });
    expect(result).toEqual(final);
  });

  it("Summarization dispatches via runSync", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("summary");
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const result = await engine.send({
      actionType: ActionType.Summarization,
      userMessage,
    });
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "summary" }],
    });
  });
});

describe("AIEngine.sendCustom", () => {
  it("returns an AsyncGenerator when isStream=true", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const out = engine.sendCustom({
      isStream: true,
      systemPrompt: "P",
      userMessage,
    });
    if (!(Symbol.asyncIterator in (out as object))) {
      throw new Error("expected an AsyncGenerator");
    }
    for await (const _ of out as AsyncGenerator<SendMessageResult>) {
      // drain
    }
  });

  it("returns a Promise when isStream=false", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("X");
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const out = await engine.sendCustom({
      isStream: false,
      systemPrompt: "P",
      userMessage,
    });
    expect(out).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "X" }],
    });
  });
});
