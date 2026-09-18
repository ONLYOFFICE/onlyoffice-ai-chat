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

/** Credentials of the provider that served a `sendMessageSync` call. */
let syncCreds: ProviderCredentials | undefined;

class StubProvider extends AbstractBaseProvider {
  constructor(creds: ProviderCredentials) {
    super(creds);
    capturedCreds = creds;
  }
  async *sendMessage(args: unknown): AsyncGenerator<SendMessageResult> {
    yield* sendMessageMock(args);
  }
  async sendMessageSync(args: unknown): Promise<string> {
    // The title action is the only `sendMessageSync` caller here — record
    // its own credentials so a later chat-provider construction can't
    // overwrite what the assertion looks at.
    syncCreds = this.creds;
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
      readById: vi.fn(async () => null),
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
      updateManyByIds: vi.fn(),
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
  syncCreds = undefined;
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
    // The generated title is multiplexed into the stream and races the
    // reply — both tail events arrive, in either order.
    const tail = yielded.slice(2);
    expect(tail.map((e) => e.type).sort()).toEqual([
      "message-end",
      "thread-title",
    ]);
    expect(tail.find((e) => e.type === "thread-title")).toMatchObject({
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

  it("yields the title mid-stream when it resolves before the reply ends", async () => {
    // Gate the provider stream so the (instant) title must win the race.
    let openGate!: () => void;
    const gate = new Promise<void>((r) => (openGate = r));
    sendMessageSyncMock.mockResolvedValueOnce("Fast Title");
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    };
    sendMessageMock.mockReturnValueOnce(
      (async function* () {
        await gate;
        yield { isEnd: true, responseMessage: final };
      })()
    );
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const iter = engine.sendWithStream({ userMessage });

    expect((await iter.next()).value).toMatchObject({
      type: "thread-title",
      title: "New chat",
    });
    expect((await iter.next()).value.type).toBe("user-message-stored");
    // Reply still streaming (gated) — the title arrives anyway.
    expect((await iter.next()).value).toMatchObject({
      type: "thread-title",
      title: "Fast Title",
    });
    expect(storage.threads.update).toHaveBeenCalledWith(
      expect.any(String),
      "Fast Title"
    );

    openGate();
    expect((await iter.next()).value.type).toBe("message-end");
    expect((await iter.next()).done).toBe(true);
  });

  // Regression: the title write ran unguarded inside the reply generator, so
  // a rejected rename (host storage down, an over-long title hitting a
  // bounded column) escaped and aborted the stream — the user lost an answer
  // that had already streamed in, and saw a generic stream error instead.
  it("keeps the reply streaming when persisting the title fails", async () => {
    let openGate!: () => void;
    const gate = new Promise<void>((r) => (openGate = r));
    sendMessageSyncMock.mockResolvedValueOnce("Doomed Title");
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    };
    sendMessageMock.mockReturnValueOnce(
      (async function* () {
        await gate;
        yield { isEnd: true, responseMessage: final };
      })()
    );
    const { storage, messages } = makeStorage();
    vi.spyOn(storage.threads, "update").mockRejectedValue(
      new Error("Data too long for column 'title'")
    );
    const engine = new AIEngine({ storage });
    const iter = engine.sendWithStream({ userMessage });

    expect((await iter.next()).value).toMatchObject({
      type: "thread-title",
      title: "New chat",
    });
    expect((await iter.next()).value.type).toBe("user-message-stored");

    // The failed rename yields no `thread-title` — showing a name that a
    // reload discards would be worse than keeping the placeholder — and the
    // reply carries on to its normal terminal event.
    openGate();
    expect((await iter.next()).value.type).toBe("message-end");
    expect((await iter.next()).done).toBe(true);
    expect(storage.threads.update).toHaveBeenCalledWith(
      expect.any(String),
      "Doomed Title"
    );
    // The assistant reply was still persisted.
    expect(messages).toEqual(
      expect.arrayContaining([expect.objectContaining(final)])
    );
  });

  it("closes immediately and keeps the default title when the title outlives the reply", async () => {
    let resolveTitle!: (t: string) => void;
    sendMessageSyncMock.mockReturnValueOnce(
      new Promise<string>((r) => (resolveTitle = r))
    );
    const final: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: final }])
    );
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const iter = engine.sendWithStream({ userMessage });

    expect((await iter.next()).value).toMatchObject({
      type: "thread-title",
      title: "New chat",
    });
    expect((await iter.next()).value.type).toBe("user-message-stored");
    expect((await iter.next()).value.type).toBe("message-end");
    // The round is over — no waiting for the title, the generator ends.
    expect((await iter.next()).done).toBe(true);

    // A late resolution is discarded: the placeholder name is final.
    resolveTitle("Late Title");
    await new Promise((r) => setTimeout(r, 0));
    expect(storage.threads.update).not.toHaveBeenCalled();
  });

  it("still delivers a late title when the round pauses on a tool call", async () => {
    let resolveTitle!: (t: string) => void;
    sendMessageSyncMock.mockReturnValueOnce(
      new Promise<string>((r) => (resolveTitle = r))
    );
    // Terminal message with an unresolved tool call — the engine pauses
    // the round with `tool-call-pending` instead of `message-end`. The tool
    // is caller-supplied (a "user" tool), so it surfaces for UI approval
    // rather than being auto-resolved as an unavailable/unknown name.
    const paused: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolName: "host_tool",
          toolCallId: "tc1",
          args: {},
        },
      ] as unknown as Exclude<ThreadMessageLike["content"], string>,
    };
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ isEnd: true, responseMessage: paused }])
    );
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    const iter = engine.sendWithStream({
      userMessage,
      actionArgs: {
        tools: [{ name: "host_tool", description: "", inputSchema: {} }],
      },
    });

    expect((await iter.next()).value.type).toBe("thread-title");
    expect((await iter.next()).value.type).toBe("user-message-stored");
    expect((await iter.next()).value.type).toBe("tool-call-pending");

    // The round isn't over (approval dialog) — the generator stays open
    // and the title still lands as a trailing event.
    const tail = iter.next();
    resolveTitle("Tool Title");
    expect((await tail).value).toMatchObject({
      type: "thread-title",
      title: "Tool Title",
    });
    expect((await iter.next()).done).toBe(true);
  });

  it("auto-resolves a call to an unavailable tool and resumes instead of surfacing a phantom approval", async () => {
    // The model calls a tool that is in no list — a name it invented, or one
    // switched off mid-thread (e.g. Web search toggled off). The engine must
    // NOT surface a `tool-call-pending` (approving a phantom tool throws and
    // hangs the turn); it feeds back a "not available" result and resumes.
    const toolCallReply: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "web_search",
          args: { q: "cats" },
        },
      ] as unknown as Exclude<ThreadMessageLike["content"], string>,
    };
    const followUp: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "text", text: "I can't search, but here's what I know" },
      ],
    };
    sendMessageSyncMock.mockResolvedValue("Title");
    sendMessageMock
      .mockReturnValueOnce(
        arrayToStream([{ isEnd: true, responseMessage: toolCallReply }])
      )
      .mockReturnValueOnce(
        arrayToStream([{ isEnd: true, responseMessage: followUp }])
      );

    const { storage } = makeStorage();
    // Web search is not configured → `web_search` is not in the tools list.
    const persisted: ThreadMessageLike[] = [];
    (storage.messages.update as ReturnType<typeof vi.fn>).mockImplementation(
      async (_id: string, m: ThreadMessageLike) => {
        persisted.push(m);
      }
    );
    const engine = new AIEngine({ storage });

    const events = [];
    for await (const e of engine.sendWithStream({ userMessage })) {
      events.push(e);
    }

    // No phantom approval surfaced, and the round completed via a resume.
    expect(events.map((e) => e.type)).not.toContain("tool-call-pending");
    expect(events.map((e) => e.type)).toContain("message-end");
    expect(sendMessageMock).toHaveBeenCalledTimes(2);

    // The tool call was resolved in-engine with a "not available" error.
    const errored = persisted.find(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (c) =>
            (c as { type?: string }).type === "tool-call" &&
            typeof (c as { result?: unknown }).result === "string" &&
            (c as { result: string }).result.includes("is not available")
        )
    );
    expect(errored).toBeDefined();
  });

  it("hydrates image refs before the first-message title request", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Titled");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
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
        { type: "text", text: "what is this?" },
      ],
    };
    for await (const _ of engine.sendWithStream({
      userMessage: imageRefMessage,
    })) {
      // drain
    }
    const sent = sendMessageSyncMock.mock.calls[0][0]
      .messages as ThreadMessageLike[];
    const part = (
      sent[0].content as Array<{ type: string; image?: string }>
    )[0];
    expect(part.image).toBe("data:image/png;base64,AAAA");
  });

  it("reads existing-thread history in pages when pagination is on", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const history: ThreadMessageLike[] = Array.from(
      { length: 150 },
      (_, i) => ({
        role: "user",
        content: [{ type: "text", text: `m${i}` }],
        id: `m${i}`,
        createdAt: new Date(1000 + i),
      })
    );
    const readByThread = vi.fn(
      async (_t: string, count?: number, cursor?: { id: string }) => {
        const from = cursor
          ? history.findIndex((m) => m.id === cursor.id) + 1
          : 0;
        return history.slice(from, count ? from + count : undefined);
      }
    );
    (storage.messages as unknown as { readByThread: unknown }).readByThread =
      readByThread;
    const engine = new AIEngine({ storage, pagination: true });
    for await (const _ of engine.sendWithStream({
      threadId: "t1",
      userMessage,
    })) {
      // drain
    }
    // 150 messages → 100 + 50, two paged reads.
    expect(readByThread).toHaveBeenNthCalledWith(1, "t1", 100, undefined);
    expect(readByThread).toHaveBeenCalledTimes(2);
  });

  it("keeps the single unbounded history read when pagination is off", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      threadId: "t1",
      userMessage,
    })) {
      // drain
    }
    expect(storage.messages.readByThread).toHaveBeenCalledWith("t1");
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

describe("AIEngine.sendWithStream entity metadata", () => {
  it("carries the host entity pair into the auto-title request", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      userMessage,
      actionArgs: { entityId: "agent-7", entityTitle: "Support agent" },
    })) {
      // drain
    }
    expect(syncCreds?.entityId).toBe("agent-7");
    expect(syncCreds?.entityTitle).toBe("Support agent");
  });

  it("sends no entity pair on the title request when the host described none", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({ userMessage })) {
      // drain
    }
    expect(syncCreds?.entityId).toBeUndefined();
    expect(syncCreds?.entityTitle).toBeUndefined();
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

  it("stamps contextEntityId into the persisted user message", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage, messages } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      userMessage,
      entityId: "local-folder",
      contextEntityId: "agent-room",
    })) {
      // drain
    }
    const storedUser = messages.find((m) => m.role === "user");
    expect(storedUser?.metadata?.custom?.["contextEntityId"]).toBe(
      "agent-room"
    );
  });

  it("does not stamp the user message without contextEntityId", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage, messages } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      userMessage,
      entityId: "e1",
    })) {
      // drain
    }
    const storedUser = messages.find((m) => m.role === "user");
    expect(storedUser?.metadata).toBeUndefined();
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

  describe("turn selection", () => {
    /** Two complete rounds: user-1 / asst-1, then user-2 / asst-2. */
    const twoRounds = (): ThreadMessageLike[] => [
      { id: "user-1", role: "user", content: [{ type: "text", text: "one" }] },
      {
        id: "asst-1",
        role: "assistant",
        content: [{ type: "text", text: "reply one" }],
      },
      { id: "user-2", role: "user", content: [{ type: "text", text: "two" }] },
      {
        id: "asst-2",
        role: "assistant",
        content: [{ type: "text", text: "reply two" }],
      },
    ];

    const runRegenerate = async (
      input: Omit<Parameters<AIEngine["regenerateStream"]>[0], "threadId">
    ) => {
      sendMessageMock.mockReturnValueOnce(arrayToStream([]));
      const { storage } = makeStorage();
      (
        storage.messages.readByThread as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(twoRounds());

      const engine = new AIEngine({ storage });
      for await (const _ of engine.regenerateStream({
        threadId: "t1",
        ...input,
      })) {
        // drain
      }

      return {
        deleted: (
          storage.messages.delete as ReturnType<typeof vi.fn>
        ).mock.calls.map((c: unknown[]) => c[0]),
        sent: (
          sendMessageMock.mock.calls[0][0] as {
            messages: ThreadMessageLike[];
          }
        ).messages,
      };
    };

    it("rewinds to the message named by messageId, not the newest turn", async () => {
      const { deleted, sent } = await runRegenerate({ messageId: "user-1" });

      expect(deleted).toEqual(["asst-1", "user-2", "asst-2"]);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ id: "user-1" });
    });

    it("falls back to keepCount when messageId is an optimistic id storage never saw", async () => {
      const { deleted, sent } = await runRegenerate({
        messageId: "client-side-uuid",
        keepCount: 1,
      });

      expect(deleted).toEqual(["asst-1", "user-2", "asst-2"]);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ id: "user-1" });
    });

    it("prefers a resolvable messageId over keepCount", async () => {
      const { sent } = await runRegenerate({
        messageId: "user-1",
        keepCount: 3,
      });

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ id: "user-1" });
    });

    it("ignores a keepCount that does not land on a user message", async () => {
      // keepCount 2 points at asst-1 — a stale count. Rather than
      // re-rolling the wrong turn, degrade to the last user message.
      const { deleted, sent } = await runRegenerate({
        messageId: "gone",
        keepCount: 2,
      });

      expect(deleted).toEqual(["asst-2"]);
      expect(sent).toHaveLength(3);
      expect(sent[2]).toMatchObject({ id: "user-2" });
    });

    it("ignores a messageId pointing at an assistant message", async () => {
      const { deleted, sent } = await runRegenerate({ messageId: "asst-1" });

      expect(deleted).toEqual(["asst-2"]);
      expect(sent[sent.length - 1]).toMatchObject({ id: "user-2" });
    });

    it("re-rolls the last user message when neither hint is given", async () => {
      const { deleted, sent } = await runRegenerate({});

      expect(deleted).toEqual(["asst-2"]);
      expect(sent).toHaveLength(3);
      expect(sent[2]).toMatchObject({ id: "user-2" });
    });
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

describe("AIEngine profile persistence (Bug 82860)", () => {
  it("keeps the thread's stored profile when sendWithStream omits profileId", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    (
      storage.threads.readById as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      threadId: "t1",
      title: "x",
      lastEditDate: 0,
      profileId: "thread-profile",
    });
    (
      storage.messages.readByThread as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([]);

    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      threadId: "t1",
      userMessage,
    })) {
      // drain
    }

    // The thread's own profile is recovered and used for the round — not the
    // Chat assignment, which would overwrite the thread's model. (readByType
    // is still consulted for the ImageGeneration tool slot, so assert only
    // that the Chat slot was never resolved.)
    expect(storage.profiles.readById).toHaveBeenCalledWith("thread-profile");
    expect(storage.assignments.readByType).not.toHaveBeenCalledWith(
      ActionType.Chat,
      undefined
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

  it("resolves the supplied profileId instead of the Default slot", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("X");
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    await engine.sendCustom({
      isStream: false,
      systemPrompt: "P",
      userMessage,
      profileId: "picked",
    });
    expect(storage.profiles.readById).toHaveBeenCalledWith("picked");
    // The explicit pick short-circuits the Default assignment lookup.
    expect(storage.assignments.readByType).not.toHaveBeenCalled();
  });

  it("falls back to the Default slot when profileId is not found", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("X");
    const { storage } = makeStorage();
    (storage.profiles.readById as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: string) => (id === "gone" ? null : profile)
    );
    const engine = new AIEngine({ storage });
    await engine.sendCustom({
      isStream: false,
      systemPrompt: "P",
      userMessage,
      profileId: "gone",
    });
    expect(storage.assignments.readByType).toHaveBeenCalledWith(
      ActionType.Default,
      undefined
    );
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

describe("AIEngine source", () => {
  const SOURCE = { id: "room-9", type: "Room", title: "Sales" };

  it("resolves the source through the hook and sends it on the chat and title requests", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const resolveSource = vi.fn().mockResolvedValue(SOURCE);
    const engine = new AIEngine({ storage, resolveSource });
    for await (const _ of engine.sendWithStream({
      userMessage,
      entityId: "room-9",
    })) {
      // drain
    }
    expect(resolveSource).toHaveBeenCalledWith({
      entityId: "room-9",
      threadId: undefined,
    });
    expect(syncCreds?.source).toEqual(SOURCE);
    expect(capturedCreds?.source).toEqual(SOURCE);
  });

  it("asks the hook with the context scope rather than the thread's entity", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const resolveSource = vi.fn().mockReturnValue(undefined);
    const engine = new AIEngine({ storage, resolveSource });
    for await (const _ of engine.sendWithStream({
      userMessage,
      entityId: "history",
      contextEntityId: "agent-7",
    })) {
      // drain
    }
    expect(resolveSource).toHaveBeenCalledWith({
      entityId: "agent-7",
      threadId: undefined,
    });
  });

  it("the hook's answer is final — a caller-supplied source is ignored", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({
      storage,
      resolveSource: () => undefined,
    });
    for await (const _ of engine.sendWithStream({
      userMessage,
      actionArgs: { source: { id: "claimed" } },
    })) {
      // drain
    }
    expect(syncCreds?.source).toBeUndefined();
    expect(capturedCreds?.source).toBeUndefined();
  });

  it("without a hook the caller-supplied source is used as-is", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage });
    for await (const _ of engine.sendWithStream({
      userMessage,
      actionArgs: { source: SOURCE },
    })) {
      // drain
    }
    expect(syncCreds?.source).toEqual(SOURCE);
    expect(capturedCreds?.source).toEqual(SOURCE);
  });
});

describe("AIEngine source — hook is authoritative over the legacy pair", () => {
  it("drops the caller's entityId / entityTitle when the hook resolves nothing", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Title");
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage } = makeStorage();
    const engine = new AIEngine({ storage, resolveSource: () => undefined });
    for await (const _ of engine.sendWithStream({
      userMessage,
      actionArgs: { entityId: "claimed-agent", entityTitle: "Claimed" },
    })) {
      // drain
    }
    expect(syncCreds?.entityId).toBeUndefined();
    expect(syncCreds?.entityTitle).toBeUndefined();
    expect(syncCreds?.source).toBeUndefined();
    expect(capturedCreds?.entityId).toBeUndefined();
    expect(capturedCreds?.source).toBeUndefined();
  });

  it("drops the legacy pair on the deny / resume path too", async () => {
    sendMessageMock.mockReturnValueOnce(arrayToStream([]));
    const { storage, messages } = makeStorage();
    const SOURCE = { id: "room-9", type: "Room" };
    const resolveSource = vi.fn().mockResolvedValue(SOURCE);
    const engine = new AIEngine({ storage, resolveSource });
    const assistant = {
      id: "a1",
      role: "assistant" as const,
      content: [
        {
          type: "tool-call" as const,
          toolCallId: "c1",
          toolName: "some_tool",
          args: {},
        },
      ],
    };
    messages.push({ ...assistant, threadId: "t1" } as never);
    for await (const _ of engine.denyToolCall({
      threadId: "t1",
      messageId: "a1",
      idx: 0,
      message: assistant,
      entityId: "room-9",
      actionArgs: { entityId: "claimed-agent", entityTitle: "Claimed" },
    })) {
      // drain
    }
    expect(resolveSource).toHaveBeenCalledTimes(1);
    expect(capturedCreds?.source).toEqual(SOURCE);
    expect(capturedCreds?.entityId).toBeUndefined();
  });
});
