import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Profile, Thread } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import {
  registerProvider,
  unregisterProvider,
} from "../../../providers";
import type { StorageAdapter } from "../../../storage";
import { ThreadsEngine } from "../engine";

const sendMessageSyncMock = vi.fn();

class TitleStubProvider extends AbstractBaseProvider {
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

function makeStorage(seed: {
  threads?: Thread[];
  messagesByThread?: Record<string, ThreadMessageLike[]>;
} = {}) {
  let threads: Thread[] = [...(seed.threads ?? [])];
  const messages = new Map<string, ThreadMessageLike[]>();
  for (const [tid, list] of Object.entries(seed.messagesByThread ?? {})) {
    messages.set(tid, [...list]);
  }

  const storage = {
    threads: {
      create: vi.fn(async (title: string, profileId?: string) => {
        const threadId = crypto.randomUUID();
        const thread: Thread = {
          threadId,
          title,
          profileId,
          lastEditDate: Date.now(),
        };
        threads.push(thread);
        return thread;
      }),
      readAll: vi.fn(async () => [...threads]),
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
        async (tid: string, limit?: number, start = 0) => {
          const list = messages.get(tid) ?? [];
          const sliced = list.slice(start, limit ? start + limit : undefined);
          return sliced;
        }
      ),
      deleteByThread: vi.fn(async (tid: string) => {
        messages.delete(tid);
      }),
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
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-0000-0000-000000000001");
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

describe("ThreadsEngine.create", () => {
  it("returns the persisted thread with id assigned by storage", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new ThreadsEngine({ storage });
    const thread = await engine.create({ title: "T", profileId: "p1" });
    expect(thread.threadId).toBe("00000000-0000-0000-0000-000000000001");
    expect(thread.title).toBe("T");
    expect(thread.profileId).toBe("p1");
    expect(snapshot().threads).toEqual([
      { threadId: thread.threadId, title: "T", profileId: "p1", lastEditDate: 1000 },
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
});

describe("ThreadsEngine.appendUserMessage", () => {
  it("persists the message and bumps lastEditDate", async () => {
    const { storage, snapshot } = makeStorage({
      threads: [{ threadId: "t1", title: "T" }],
    });
    const engine = new ThreadsEngine({ storage });
    const id = await engine.appendUserMessage("t1", userMessage, "p1");
    expect(id).toBe("00000000-0000-0000-0000-000000000001");
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
    const msgs = await engine.readMessages("t1", 5, 0);
    expect(msgs).toEqual([userMessage]);
    expect(storage.messages.readByThread).toHaveBeenCalledWith("t1", 5, 0);
  });
});
