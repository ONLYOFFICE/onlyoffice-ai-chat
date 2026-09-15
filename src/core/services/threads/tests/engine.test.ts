import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile, Thread } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import { registerProvider, unregisterProvider } from "../../../providers";
import type { ProviderCredentials } from "../../../../shared/provider-credentials";
import type { StorageAdapter } from "../../../storage";
import { ThreadsEngine } from "../engine";

const sendMessageSyncMock = vi.fn();

/** Credentials the last constructed stub provider was handed. */
let lastCreds: ProviderCredentials | undefined;

class TitleStubProvider extends AbstractBaseProvider {
  constructor(creds: ProviderCredentials) {
    super(creds);
    lastCreds = creds;
  }
  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<never> {
    throw new Error("not used");
  }
  async sendMessageSync(args: unknown): Promise<string> {
    return sendMessageSyncMock(args);
  }
  static getName(): string {
    return "TitleStub";
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

const STUB = "thread-title-stub";

const profile: Profile = {
  id: "p1",
  name: "P",
  providerType: STUB,
  baseUrl: "https://stub",
  modelId: "m",
};

function makeStorage(
  seed: {
    threads?: Thread[];
    messagesByThread?: Record<string, ThreadMessageLike[]>;
  } = {}
) {
  let threads: Thread[] = [...(seed.threads ?? [])];
  const messages = new Map<string, ThreadMessageLike[]>();
  for (const [tid, list] of Object.entries(seed.messagesByThread ?? {})) {
    messages.set(tid, [...list]);
  }

  const storage = {
    threads: {
      create: vi.fn(
        async (title: string, profileId?: string, entityId?: string) => {
          const threadId = crypto.randomUUID();
          const thread: Thread & { entityId?: string } = {
            threadId,
            title,
            profileId,
            lastEditDate: Date.now(),
          };
          if (entityId !== undefined) {
            (thread as { entityId?: string }).entityId = entityId;
          }
          threads.push(thread);
          return thread;
        }
      ),
      readAll: vi.fn(async (entityId?: string) =>
        threads.filter(
          (t) => (t as { entityId?: string }).entityId === entityId
        )
      ),
      update: vi.fn(async (id: string, title?: string) => {
        const t = threads.find((x) => x.threadId === id);
        if (t) t.title = title ?? t.title;
      }),
      touch: vi.fn(
        async (
          id: string,
          ts: number,
          updates?: { profileId?: string | null }
        ) => {
          const t = threads.find((x) => x.threadId === id);
          if (t) {
            t.lastEditDate = ts;
            if (updates?.profileId !== undefined) {
              t.profileId = updates.profileId ?? undefined;
            }
          }
        }
      ),
      delete: vi.fn(async (id: string) => {
        threads = threads.filter((t) => t.threadId !== id);
        messages.delete(id);
      }),
    },
    messages: {
      create: vi.fn(
        async (
          tid: string,
          msg: Omit<ThreadMessageLike, "id" | "createdAt">
        ): Promise<ThreadMessageLike> => {
          const stored: ThreadMessageLike = {
            ...msg,
            id: crypto.randomUUID(),
            createdAt: new Date(Date.now()),
          };
          const list = messages.get(tid) ?? [];
          list.push(stored);
          messages.set(tid, list);
          return stored;
        }
      ),
      readByThread: vi.fn(
        async (tid: string, count?: number, cursor?: { id: string }) => {
          const list = messages.get(tid) ?? [];
          const from = cursor
            ? list.findIndex((m) => m.id === cursor.id) + 1
            : 0;
          return list.slice(from, count ? from + count : undefined);
        }
      ),
      deleteByThread: vi.fn(async (tid: string) => {
        messages.delete(tid);
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
    },
  } as unknown as StorageAdapter;

  return {
    storage,
    snapshot: () => ({
      threads: [...threads],
      messages: Object.fromEntries(messages),
    }),
  };
}

beforeEach(() => {
  registerProvider(STUB, TitleStubProvider);
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

const userMessage: ThreadMessageLike = {
  role: "user",
  content: [{ type: "text", text: "hi" }],
};

/** User message whose image is a persisted ref marker, not inline base64. */
const imageRefMessage: ThreadMessageLike = {
  role: "user",
  content: [
    {
      type: "image",
      image: JSON.stringify({ ref: "att-1", title: "img", kind: "image" }),
      name: "img",
    } as unknown as Extract<
      Exclude<ThreadMessageLike["content"], string>[number],
      { type: "image" }
    >,
    { type: "text", text: "what is this?" },
  ],
};

/** Read the image value the provider actually received for the title call. */
const sentImage = (): string | undefined => {
  const sent = sendMessageSyncMock.mock.calls[0][0]
    .messages as ThreadMessageLike[];
  const part = (sent[0].content as Array<{ type: string; image?: string }>)[0];
  return part.image;
};

describe("ThreadsEngine.create", () => {
  it("returns the persisted thread with id assigned by storage", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    const thread = await engine.create({ title: "T", profileId: "p1" });
    expect(thread.threadId).toBe("00000000-0000-0000-0000-000000000001");
    expect(thread.title).toBe("T");
    expect(thread.profileId).toBe("p1");
    expect(snapshot().threads).toEqual([
      {
        threadId: thread.threadId,
        title: "T",
        profileId: "p1",
        lastEditDate: 1000,
      },
    ]);
  });
});

describe("ThreadsEngine.openOrCreate", () => {
  it("returns prior history for an existing thread without re-fetching the title", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "X" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    const result = await engine.openOrCreate({
      threadId: "t1",
      profile,
      profileId: "p1",
      firstMessage: userMessage,
    });
    expect(result.threadId).toBe("t1");
    expect(result.title).toBe("");
    expect(result.priorMessages).toEqual([userMessage]);
  });

  it("creates a new thread with auto-generated title", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Auto Title");
    const { storage, snapshot } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    const result = await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: userMessage,
    });
    expect(result.title).toBe("Auto Title");
    expect(snapshot().threads).toHaveLength(1);
  });

  it("falls back to 'New chat' when generated title is empty", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("   ");
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    const result = await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: userMessage,
    });
    expect(result.title).toBe("New chat");
  });

  it("hydrates image refs before the title call", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Auto Title");
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: imageRefMessage,
    });
    expect(sentImage()).toBe("data:image/png;base64,AAAA");
  });

  it("forwards entityMeta to the title request's credentials", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Auto Title");
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: userMessage,
      entityMeta: { entityId: "agent-7", entityTitle: "Support agent" },
    });
    expect(lastCreds?.entityId).toBe("agent-7");
    expect(lastCreds?.entityTitle).toBe("Support agent");
  });
});

describe("ThreadsEngine.appendUserMessage", () => {
  it("persists the message and bumps lastEditDate", async () => {
    const { storage, snapshot } = makeStorage({
      threads: [{ threadId: "t1", title: "T" }],
    });
    const engine = new ThreadsEngine({ storage });
    const stored = await engine.appendUserMessage("t1", userMessage, "p1");
    expect(stored.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(stored.role).toBe("user");
    expect(storage.messages.create).toHaveBeenCalledWith("t1", userMessage);
    expect(storage.threads.touch).toHaveBeenCalledWith("t1", 1000, {
      profileId: "p1",
    });
    expect(snapshot().threads[0].lastEditDate).toBe(1000);
  });
});

describe("ThreadsEngine.rename", () => {
  it("updates title and bumps lastEditDate", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
    });
    const engine = new ThreadsEngine({ storage });
    await engine.rename("t1", "New");
    expect(storage.threads.update).toHaveBeenCalledWith("t1", "New");
    expect(storage.threads.touch).toHaveBeenCalledWith("t1", 1000);
  });
});

describe("ThreadsEngine.delete", () => {
  it("delegates to storage.threads.delete", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "T" }],
    });
    const engine = new ThreadsEngine({ storage });
    await engine.delete("t1");
    expect(storage.threads.delete).toHaveBeenCalledWith("t1");
  });
});

describe("ThreadsEngine.clearMessages", () => {
  it("drops every message and bumps the thread", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "T" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    await engine.clearMessages("t1");
    expect(storage.messages.deleteByThread).toHaveBeenCalledWith("t1");
    expect(storage.threads.touch).toHaveBeenCalledWith("t1", 1000);
  });
});

describe("ThreadsEngine.regenerateTitle", () => {
  it("regenerates from the first message and persists the title", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Regenerated");
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    const title = await engine.regenerateTitle("t1", profile);
    expect(title).toBe("Regenerated");
    expect(storage.threads.update).toHaveBeenCalledWith("t1", "Regenerated");
  });

  it("falls back to 'New chat' when the model returns nothing", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("");
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    const title = await engine.regenerateTitle("t1", profile);
    expect(title).toBe("New chat");
  });

  it("hydrates image refs from the stored first message", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Regenerated");
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [imageRefMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    await engine.regenerateTitle("t1", profile);
    expect(sentImage()).toBe("data:image/png;base64,AAAA");
  });

  it("forwards entityMeta to the title request's credentials", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Regenerated");
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    await engine.regenerateTitle("t1", profile, {
      entityId: "agent-7",
      entityTitle: "Support agent",
    });
    expect(lastCreds?.entityId).toBe("agent-7");
    expect(lastCreds?.entityTitle).toBe("Support agent");
  });

  it("throws when the thread has no user messages", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [] },
    });
    const engine = new ThreadsEngine({ storage });
    await expect(engine.regenerateTitle("t1", profile)).rejects.toThrow(
      /no messages to derive a title from/
    );
  });
});

describe("ThreadsEngine entity scope", () => {
  it("create() forwards entityId to storage.threads.create", async () => {
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.create({ title: "T", profileId: "p1", entityId: "e1" });
    expect(storage.threads.create).toHaveBeenCalledWith("T", "p1", "e1");
  });

  it("create() omits entityId when not provided (passthrough mode)", async () => {
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.create({ title: "T", profileId: "p1" });
    expect(storage.threads.create).toHaveBeenCalledWith("T", "p1", undefined);
  });

  it("openOrCreate() persists entityId on a freshly created thread", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Auto");
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: userMessage,
      entityId: "e1",
    });
    expect(storage.threads.create).toHaveBeenCalledWith("Auto", "p1", "e1");
  });

  it("list(entityId) forwards entityId to storage.threads.readAll", async () => {
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.list("e1");
    expect(storage.threads.readAll).toHaveBeenCalledWith(
      "e1",
      undefined,
      undefined,
      undefined
    );
  });

  it("list() returns only threads bound to the requested scope", async () => {
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.create({ title: "Global" });
    await engine.create({ title: "Room A", entityId: "e1" });
    await engine.create({ title: "Room B", entityId: "e2" });

    const unscoped = await engine.list();
    expect(unscoped.map((t) => t.title)).toEqual(["Global"]);

    const roomA = await engine.list("e1");
    expect(roomA.map((t) => t.title)).toEqual(["Room A"]);

    const roomB = await engine.list("e2");
    expect(roomB.map((t) => t.title)).toEqual(["Room B"]);
  });
});

describe("ThreadsEngine pass-through readers", () => {
  it("list() proxies storage.threads.readAll", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "T" }],
    });
    const engine = new ThreadsEngine({ storage });
    const list = await engine.list();
    expect(list).toHaveLength(1);
  });

  it("readMessages() proxies storage.messages.readByThread with same args", async () => {
    const { storage } = makeStorage({
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    const cursor = { createdAt: "2026-01-01T00:00:00.000Z", id: "m0" };
    const msgs = await engine.readMessages("t1", 5, cursor);
    expect(msgs).toEqual([userMessage]);
    expect(storage.messages.readByThread).toHaveBeenCalledWith(
      "t1",
      5,
      cursor,
      undefined
    );
  });

  it("readMessages() forwards the read direction to storage", async () => {
    const { storage } = makeStorage({
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    await engine.readMessages("t1", 5, undefined, "desc");
    expect(storage.messages.readByThread).toHaveBeenCalledWith(
      "t1",
      5,
      undefined,
      "desc"
    );
  });

  it("list() forwards count, cursor and query to storage.threads.readAll", async () => {
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    const cursor = { lastEditDate: 500, threadId: "t9", id: "t9" };
    await engine.list("e1", 100, cursor, "report");
    expect(storage.threads.readAll).toHaveBeenCalledWith(
      "e1",
      100,
      cursor,
      "report"
    );
  });
});

describe("ThreadsEngine pagination flag", () => {
  const msg = (id: number): ThreadMessageLike => ({
    role: "user",
    content: [{ type: "text", text: `m${id}` }],
    id: `m${id}`,
    createdAt: new Date(1000 + id),
  });

  it("openOrCreate reads history in pages when pagination is on", async () => {
    const history = Array.from({ length: 150 }, (_, i) => msg(i));
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "X" }],
      messagesByThread: { t1: history },
    });
    const engine = new ThreadsEngine({ storage, pagination: true });
    const result = await engine.openOrCreate({
      threadId: "t1",
      profile,
      profileId: "p1",
      firstMessage: userMessage,
    });
    expect(result.priorMessages).toHaveLength(150);
    // 100 + 50 → two pages.
    expect(storage.messages.readByThread).toHaveBeenCalledTimes(2);
    expect(storage.messages.readByThread).toHaveBeenNthCalledWith(
      1,
      "t1",
      100,
      undefined
    );
  });

  it("openOrCreate keeps the single unbounded read when pagination is off", async () => {
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "X" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({ storage });
    await engine.openOrCreate({
      threadId: "t1",
      profile,
      profileId: "p1",
      firstMessage: userMessage,
    });
    expect(storage.messages.readByThread).toHaveBeenCalledTimes(1);
    expect(storage.messages.readByThread).toHaveBeenCalledWith("t1");
  });
});

describe("ThreadsEngine source", () => {
  const SOURCE = { id: "room-9", type: "Room", title: "Sales" };

  it("openOrCreate resolves the source through the hook and sends it on the title request", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Auto Title");
    const { storage } = makeStorage();
    const resolveSource = vi.fn().mockResolvedValue(SOURCE);
    const engine = new ThreadsEngine({ storage, resolveSource });
    await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: userMessage,
      entityId: "room-9",
      entityMeta: { source: { id: "claimed" } },
    });
    expect(resolveSource).toHaveBeenCalledWith({ entityId: "room-9" });
    expect(lastCreds?.source).toEqual(SOURCE);
  });

  it("openOrCreate uses entityMeta.source when no hook is wired", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Auto Title");
    const { storage } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    await engine.openOrCreate({
      profile,
      profileId: "p1",
      firstMessage: userMessage,
      entityMeta: { source: SOURCE },
    });
    expect(lastCreds?.source).toEqual(SOURCE);
  });

  it("regenerateTitle resolves the source through the hook with the thread id", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Regenerated");
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [userMessage] },
    });
    const resolveSource = vi.fn().mockReturnValue(SOURCE);
    const engine = new ThreadsEngine({ storage, resolveSource });
    await engine.regenerateTitle("t1", profile, { entityId: "room-9" });
    expect(resolveSource).toHaveBeenCalledWith({
      entityId: "room-9",
      threadId: "t1",
    });
    expect(lastCreds?.source).toEqual(SOURCE);
  });
});

describe("ThreadsEngine source — hook is authoritative over the legacy pair", () => {
  it("regenerateTitle drops the caller's entityId / entityTitle when the hook resolves nothing", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("Regenerated");
    const { storage } = makeStorage({
      threads: [{ threadId: "t1", title: "Old" }],
      messagesByThread: { t1: [userMessage] },
    });
    const engine = new ThreadsEngine({
      storage,
      resolveSource: () => undefined,
    });
    await engine.regenerateTitle("t1", profile, {
      entityId: "claimed-agent",
      entityTitle: "Claimed",
    });
    expect(lastCreds?.entityId).toBeUndefined();
    expect(lastCreds?.entityTitle).toBeUndefined();
    expect(lastCreds?.source).toBeUndefined();
  });
});
