import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Profile } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import { registerProvider, unregisterProvider } from "../../../providers";
import type { StorageAdapter } from "../../../storage";
import { AIEngine } from "../engine";

const sendMessageMock = vi.fn();
const sendMessageSyncMock = vi.fn();

class StubProvider extends AbstractBaseProvider {
  async *sendMessage(
    args: unknown
  ): AsyncGenerator<{ isEnd: boolean; responseMessage: ThreadMessageLike }> {
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

const STUB = "engine-resume-stub";
const profile: Profile = {
  id: "p1",
  name: "P",
  providerType: STUB,
  baseUrl: "https://stub",
  modelId: "m",
  capabilities: 0xff,
};

function makeStorage() {
  let messages: ThreadMessageLike[] = [];
  let allowAlways: string[] = [];
  const update = vi.fn(async (id: string, msg: ThreadMessageLike) => {
    messages = messages.map((m) =>
      (m as { id?: string }).id === id ? { ...msg, id } : m
    );
  });
  const create = vi.fn(async (_t: string, m: ThreadMessageLike) => {
    const stored = { ...m, id: `m${messages.length + 1}` };
    messages.push(stored);
    return stored;
  });
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
      create: vi.fn(),
      readAll: vi.fn(async () => []),
      update: vi.fn(),
      touch: vi.fn(),
      delete: vi.fn(),
    },
    messages: {
      create,
      readByThread: vi.fn(async () => [...messages]),
      update,
      deleteByThread: vi.fn(),
    },
    webSearch: { read: vi.fn(async () => null) },
    toolPrefs: {
      readAllowAlways: vi.fn(async () => [...allowAlways]),
      readDisabled: vi.fn(async () => ({})),
      upsertAllowAlways: vi.fn(async (next: string[]) => {
        allowAlways = next;
      }),
    },
  } as unknown as StorageAdapter;
  return {
    storage,
    get messages() {
      return messages;
    },
    get allowAlways() {
      return allowAlways;
    },
  };
}

async function* arrayToStream(items: { isEnd: boolean; responseMessage: ThreadMessageLike }[]) {
  for (const it of items) yield it;
}

beforeEach(() => {
  registerProvider(STUB, StubProvider);
  sendMessageMock.mockReset();
  sendMessageSyncMock.mockReset();
});

afterEach(() => {
  unregisterProvider(STUB);
  vi.restoreAllMocks();
});

const toolCallMessage: ThreadMessageLike = {
  role: "assistant",
  content: [
    { type: "tool-call", toolCallId: "c1", toolName: "search", args: { q: 1 } },
  ],
} as ThreadMessageLike;

describe("AIEngine.approveToolCall", () => {
  it("persists the tool result and yields message-end after resume", async () => {
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "after-tool" }],
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: final }])
    );
    const { storage } = makeStorage();
    // Pre-populate storage with the assistant tool-call message so
    // approveToolCall has something to update.
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });

    const events = [];
    for await (const e of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "tool-result",
    })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["message-end"]);
    expect(storage.messages.update).toHaveBeenCalled();
  });

  it("records the tool name in allowAlways when allowAlways is set", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "x" }],
          },
        },
      ])
    );
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      allowAlways: true,
    })) {
      void _;
    }
    expect(storage.toolPrefs.upsertAllowAlways).toHaveBeenCalledWith([
      "search",
    ]);
  });

  it("does not duplicate already-allowed tool", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    storage.toolPrefs.readAllowAlways = vi.fn(async () => ["search"]);
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    for await (const _ of engine.approveToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
      result: "ok",
      allowAlways: true,
    })) {
      void _;
    }
    expect(storage.toolPrefs.upsertAllowAlways).not.toHaveBeenCalled();
  });
});

describe("AIEngine.denyToolCall", () => {
  it("resumes the chat with a deny payload", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          isEnd: true,
          responseMessage: {
            role: "assistant",
            content: [{ type: "text", text: "ok" }],
          },
        },
      ])
    );
    const { storage } = makeStorage();
    await storage.messages.create("t1", toolCallMessage);
    const engine = new AIEngine({ storage });
    const events = [];
    for await (const e of engine.denyToolCall({
      threadId: "t1",
      messageId: "m1",
      idx: 0,
      message: toolCallMessage,
    })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["message-end"]);
  });
});
