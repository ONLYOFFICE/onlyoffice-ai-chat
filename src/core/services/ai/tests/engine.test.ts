import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionType } from "../../../../shared/action-type";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import type { Profile } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import { registerProvider, unregisterProvider } from "../../../providers";
import type { StorageAdapter } from "../../../storage";
import type { ProviderCredentials } from "../../../../shared/provider-credentials";
import { AssignmentsEngine } from "../../assignments";
import { ThreadsEngine } from "../../threads";
import { AIEngine } from "../engine";

const sendMessageMock = vi.fn();
const sendMessageSyncMock = vi.fn();

/** Credentials the most recently constructed StubProvider received. */
let capturedCreds: ProviderCredentials | undefined;

class StubProvider extends AbstractBaseProvider {
  constructor(creds: ProviderCredentials) {
    super(creds);
    capturedCreds = creds;
  }
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
  const threads: { threadId: string; title: string }[] = [];
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
    webSearch: {
      read: vi.fn(async () => null),
    },
    toolPrefs: {
      readAllowAlways: vi.fn(async () => []),
      readDisabled: vi.fn(async () => []),
      upsertAllowAlways: vi.fn(),
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
      update: vi.fn(),
      delete: vi.fn(async (id: string) => {
        messages = messages.filter((m) => m.id !== id);
      }),
      deleteByThread: vi.fn(async () => {
        messages = [];
      }),
    },
    attachments: {
      // Resolves any ref id to an inlined base64 data URL — the host
      // adapter's job in production.
      readManyByIds: vi.fn(async (ids: string[]) =>
        ids.map((id) => ({
          id,
          title: "img",
          base64: "data:image/png;base64,AAAA",
        }))
      ),
      create: vi.fn(),
      readById: vi.fn(async () => null),
    },
  } as unknown as StorageAdapter;
  return {
    storage,
    get messages() {
      return messages;
    },
    get threads() {
      return threads;
    },
  };
}

beforeEach(() => {
  registerProvider(STUB, StubProvider);
  sendMessageMock.mockReset();
  sendMessageSyncMock.mockReset();
  capturedCreds = undefined;
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
    expect(yielded).toHaveLength(4);
    expect(yielded[0]).toMatchObject({
      type: "thread-title",
      title: "New chat",
    });
    expect(yielded[1].type).toBe("user-message-stored");
    expect(yielded[2].type).toBe("message-end");
    expect(yielded[3]).toMatchObject({
      type: "thread-title",
      title: "My Title",
    });
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

describe("AIEngine proxy selection", () => {
  const drain = async (engine: AIEngine) => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    for await (const _ of engine.sendWithStream({ userMessage })) {
      // drain
    }
  };

  it("does not proxy when neither useProxy nor forceProxy is set", async () => {
    const { storage } = makeStorage();
    const fetchProxy = vi.fn();
    const engine = new AIEngine({ storage, fetchProxy });
    await drain(engine);
    expect(capturedCreds?.fetch).toBeUndefined();
  });

  it("forceProxy routes every request through fetchProxy regardless of useProxy", async () => {
    const { storage } = makeStorage();
    const fetchProxy = vi.fn();
    // The default profile has no `useProxy` flag set.
    const engine = new AIEngine({ storage, fetchProxy, forceProxy: true });
    await drain(engine);
    expect(capturedCreds?.fetch).toBe(fetchProxy);
  });

  it("forceProxy accepts a lazy resolver", async () => {
    const { storage } = makeStorage();
    const fetchProxy = vi.fn();
    const engine = new AIEngine({
      storage,
      fetchProxy,
      forceProxy: () => true,
    });
    await drain(engine);
    expect(capturedCreds?.fetch).toBe(fetchProxy);
  });
});

describe("AIEngine.sendWithStream entity scope", () => {
  it("forwards input.entityId to assignments.readByType and threads.create", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      userMessage,
      entityId: "e1",
    })) {
      // drain
    }
    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Chat,
      "e1"
    );
    expect(storage.threads.create).toHaveBeenCalledWith("New chat", "p1", "e1");
  });

  it("omits entityId when not provided (passthrough mode)", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({ userMessage })) {
      // drain
    }
    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Chat,
      undefined
    );
    expect(storage.threads.create).toHaveBeenCalledWith(
      "New chat",
      "p1",
      undefined
    );
  });

  it("contextEntityId scopes the context, entityId keeps the thread", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      userMessage,
      entityId: "local-folder",
      contextEntityId: "agent-room",
    })) {
      // drain
    }
    // Context (assignment fallback, tool prefs) resolves against the agent…
    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Chat,
      "agent-room"
    );
    // …while the thread itself stays placed under the caller's entity.
    expect(storage.threads.create).toHaveBeenCalledWith(
      "New chat",
      "p1",
      "local-folder"
    );
  });
});

describe("AIEngine.regenerateStream", () => {
  it("drops the previous assistant reply and re-streams against the same user prompt", async () => {
    const oldAssistant: ThreadMessageLike = {
      id: "asst-old",
      role: "assistant",
      content: [{ type: "text", text: "old reply" }],
    };
    const userPersisted: ThreadMessageLike = {
      id: "user-1",
      role: "user",
      content: [{ type: "text", text: "hi" }],
    };
    const fresh: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "fresh reply" }],
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: fresh }])
    );

    const { storage } = makeStorage();
    // Seed storage.messages.readByThread with the existing user + old assistant
    (
      storage.messages.readByThread as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([userPersisted, oldAssistant]);

    const engine = new AIEngine({ storage });
    const yielded = [];
    for await (const ev of engine.regenerateStream({ threadId: "t1" })) {
      yielded.push(ev);
    }

    expect(storage.messages.delete).toHaveBeenCalledWith("asst-old");
    // The provider call received only the user message in `messages` (no old reply).
    const callArgs = sendMessageMock.mock.calls[0][0] as {
      messages: ThreadMessageLike[];
    };
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0]).toMatchObject(userPersisted);
    // Stream emitted message-end for the fresh reply.
    expect(yielded.some((e) => e.type === "message-end")).toBe(true);
  });

  it("returns early when there is no user message in the thread", async () => {
    const { storage } = makeStorage();
    (
      storage.messages.readByThread as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([]);

    const engine = new AIEngine({ storage });
    const yielded = [];
    for await (const ev of engine.regenerateStream({ threadId: "t1" })) {
      yielded.push(ev);
    }

    expect(yielded).toHaveLength(0);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(storage.messages.delete).not.toHaveBeenCalled();
  });

  it("deletes every trailing message after the last user message (tool-call hops)", async () => {
    const userPersisted: ThreadMessageLike = {
      id: "user-1",
      role: "user",
      content: [{ type: "text", text: "do tool" }],
    };
    const toolCallAsst: ThreadMessageLike = {
      id: "asst-tool",
      role: "assistant",
      content: [{ type: "text", text: "calling tool" }],
    };
    const toolResult: ThreadMessageLike = {
      id: "tool-result",
      role: "assistant",
      content: [{ type: "text", text: "tool result" }],
    };
    const finalAsst: ThreadMessageLike = {
      id: "asst-final",
      role: "assistant",
      content: [{ type: "text", text: "final" }],
    };
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));

    const { storage } = makeStorage();
    (
      storage.messages.readByThread as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([
      userPersisted,
      toolCallAsst,
      toolResult,
      finalAsst,
    ]);

    const engine = new AIEngine({ storage });
    for await (const _ of engine.regenerateStream({ threadId: "t1" })) {
      // drain
    }

    const deletedIds = (
      storage.messages.delete as ReturnType<typeof vi.fn>
    ).mock.calls.map((c: unknown[]) => c[0]);
    expect(deletedIds).toEqual(["asst-tool", "tool-result", "asst-final"]);
  });

  it("forwards entityId to assignments.readByType", async () => {
    const userPersisted: ThreadMessageLike = {
      id: "u",
      role: "user",
      content: [{ type: "text", text: "hi" }],
    };
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    (
      storage.messages.readByThread as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([userPersisted]);

    const engine = new AIEngine({ storage });
    for await (const _ of engine.regenerateStream({
      threadId: "t1",
      entityId: "e1",
    })) {
      // drain
    }

    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Chat,
      "e1"
    );
  });
});

describe("AIEngine.send entity scope", () => {
  it("forwards input.entityId to assignments.readByType", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("summary");
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    await engine.send({
      actionType: ActionType.Summarization,
      userMessage,
      entityId: "e1",
    });
    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Summarization,
      "e1"
    );
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

  it("hydrates image refs to a data: URL before the provider (sync action)", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("desc");
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const imageRefMessage: ThreadMessageLike = {
      role: "user",
      content: [
        {
          type: "image",
          image: JSON.stringify({
            ref: "att-1",
            title: "img",
            kind: "image",
          }),
          name: "img",
        } as unknown as Extract<
          Exclude<ThreadMessageLike["content"], string>[number],
          { type: "image" }
        >,
      ],
    };
    await engine.send({
      actionType: ActionType.Vision,
      userMessage: imageRefMessage,
    });
    expect(
      (
        storage.attachments as unknown as {
          readManyByIds: ReturnType<typeof vi.fn>;
        }
      ).readManyByIds
    ).toHaveBeenCalledWith(["att-1"]);
    const sent = sendMessageSyncMock.mock.calls[0][0]
      .messages as ThreadMessageLike[];
    const part = (
      sent[0].content as Array<{ type: string; image?: string }>
    )[0];
    expect(part.image).toBe("data:image/png;base64,AAAA");
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

describe("AIEngine built-in generate_image fetch wiring", () => {
  const IMG_STUB = "ai-engine-image-stub";

  /** Credentials the most recently constructed image provider received. */
  let capturedImageCreds: ProviderCredentials | undefined;
  const imageGenerationMock = vi.fn();

  class StubImageProvider extends AbstractBaseProvider {
    constructor(creds: ProviderCredentials) {
      super(creds);
      capturedImageCreds = creds;
    }
    async *sendMessage(): AsyncGenerator<SendMessageResult> {
      // not exercised — image profile is only used for imageGeneration
    }
    async sendMessageSync(): Promise<string> {
      return "";
    }
    async imageGeneration(): Promise<string> {
      return imageGenerationMock();
    }
    static getName(): string {
      return "StubImage";
    }
    static getBaseUrl(): string {
      return "https://stub-image";
    }
    static async checkProvider(): Promise<boolean> {
      return true;
    }
    static async getProviderModels(): Promise<[]> {
      return [];
    }
  }

  // Chat profile has NO proxy; the image profile opts into useProxy. So
  // wiring `fetchProxy` into the image request can only happen if the tool
  // resolves fetch from its OWN profile via the engine's `pickFetch`.
  const imageProfile: Profile = {
    id: "img",
    name: "Image",
    providerType: IMG_STUB,
    baseUrl: "https://stub-image",
    modelId: "dall-e-3",
    capabilities: 0xff,
    useProxy: true,
  };

  beforeEach(() => {
    registerProvider(IMG_STUB, StubImageProvider);
    capturedImageCreds = undefined;
    imageGenerationMock.mockReset().mockResolvedValue("B64");
  });

  afterEach(() => {
    unregisterProvider(IMG_STUB);
  });

  it("auto-executes generate_image and wires the image profile's proxy fetch (regression: pickFetch dropped from runChatStream ctx)", async () => {
    const { storage } = makeStorage();
    // Route ImageGeneration to the image profile; everything else stays p1.
    (
      storage.assignments.readByType as ReturnType<typeof vi.fn>
    ).mockImplementation(async (type: ActionType) =>
      type === ActionType.ImageGeneration ? "img" : "p1"
    );
    (storage.profiles.readById as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: string) => (id === "img" ? imageProfile : profile)
    );
    // persistGeneratedImage swaps base64 → an attachment ref.
    (storage as unknown as { attachments: unknown }).attachments = {
      create: vi.fn(async () => ({ id: "att1" })),
      readById: vi.fn(async () => null),
    };

    const toolCallReply: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "generate_image",
          args: { prompt: "a cat" },
        },
      ],
    };
    const followUp: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "here you go" }],
    };
    sendMessageSyncMock.mockResolvedValue("Title");
    // 1st provider round: the model asks for the image. 2nd round (resume
    // after the tool runs): a plain text reply that ends the stream.
    sendMessageMock
      .mockReturnValueOnce(
        arrayToStream([{ isEnd: true, responseMessage: toolCallReply }])
      )
      .mockReturnValueOnce(
        arrayToStream([{ isEnd: true, responseMessage: followUp }])
      );

    const fetchProxy = vi.fn();
    const engine = new AIEngine({ storage, fetchProxy });
    for await (const _ of engine.sendWithStream({ userMessage })) {
      // drain
    }

    expect(imageGenerationMock).toHaveBeenCalledTimes(1);
    // The image provider was built with the image profile's proxy fetch...
    expect(capturedImageCreds?.fetch).toBe(fetchProxy);
    // ...even though the chat profile itself never opts into the proxy.
    expect(capturedCreds?.fetch).toBeUndefined();
  });
});
