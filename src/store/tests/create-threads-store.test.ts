import { describe, expect, it, vi, beforeEach } from "vitest";
import { CallbacksManager } from "../../events/callbacks";
import type { ThreadsService } from "../../services/threads";
import type { Thread } from "../../types";
import { createThreadsStore } from "../create-threads-store";
import { create } from "zustand";
import type { ProfilesStoreState } from "../create-profiles-store";
import type { MessageStoreState } from "../create-message-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeThread(id: string, title = "Thread"): Thread {
  return { threadId: id, title, lastEditDate: Date.now() };
}

function makeProfilesStore() {
  return create<Partial<ProfilesStoreState>>()(() => ({
    profiles: [],
    defaultProfile: null,
    chatProfile: null,
    getProfileById: vi.fn().mockReturnValue(null),
    setSessionChatProfile: vi.fn(),
  }));
}

function makeMessageStore() {
  return create<Partial<MessageStoreState>>()(() => ({
    messages: [],
    clearMessages: vi.fn(),
  }));
}

function makeThreadsService(
  overrides?: Partial<ThreadsService>
): ThreadsService {
  return {
    loadAll: vi.fn().mockResolvedValue([]),
    createThread: vi.fn(
      (id: string, title: string, profileId?: string): Thread => ({
        threadId: id,
        title,
        profileId,
        lastEditDate: Date.now(),
      })
    ),
    touchThread: vi.fn(),
    migrateThreadToProfile: vi.fn(
      (thread: Thread): Thread => ({
        ...thread,
        provider: undefined,
        model: undefined,
        profileId: "migrated",
      })
    ),
    downloadThread: vi.fn(),
    renameThread: vi.fn(),
    deleteThread: vi.fn(),
    clearHistory: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ThreadsService;
}

describe("createThreadsStore", () => {
  let service: ThreadsService;
  let profilesStore: ReturnType<typeof makeProfilesStore>;
  let messageStore: ReturnType<typeof makeMessageStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeThreadsService();
    profilesStore = makeProfilesStore();
    messageStore = makeMessageStore();
  });

  function createStore() {
    return createThreadsStore({
      threadsService: service,
      useProfilesStore: profilesStore as unknown as Parameters<
        typeof createThreadsStore
      >[0]["useProfilesStore"],
      useMessageStore: messageStore as unknown as Parameters<
        typeof createThreadsStore
      >[0]["useMessageStore"],
      callbacksManager: new CallbacksManager(),
    });
  }

  it("starts with a random threadId and empty threads", () => {
    const store = createStore();
    expect(store.getState().threadId).toBeTruthy();
    expect(store.getState().threads).toEqual([]);
  });

  describe("initThreads", () => {
    it("loads threads from service", async () => {
      const threads = [makeThread("t1"), makeThread("t2")];
      service = makeThreadsService({
        loadAll: vi.fn().mockResolvedValue(threads),
      } as unknown as Partial<ThreadsService>);
      const store = createStore();
      await store.getState().initThreads();
      expect(store.getState().threads).toEqual(threads);
    });
  });

  describe("insertThread", () => {
    it("prepends a new thread", () => {
      const store = createStore();
      store.getState().insertThread("Hello");
      expect(store.getState().threads).toHaveLength(1);
      expect(store.getState().threads[0].title).toBe("Hello");
    });

    it("passes profileId to service", () => {
      const store = createStore();
      store.getState().insertThread("Title", { profileId: "p1" });
      expect(service.createThread).toHaveBeenCalledWith(
        store.getState().threadId,
        "Title",
        "p1"
      );
    });
  });

  describe("insertNewMessageToThread", () => {
    it("touches thread and updates lastEditDate", () => {
      const store = createStore();
      const threadId = store.getState().threadId;
      const thread = makeThread(threadId);
      store.setState({ threads: [thread] });

      store.getState().insertNewMessageToThread();
      expect(service.touchThread).toHaveBeenCalledWith(threadId, undefined);
      expect(store.getState().threads[0].lastEditDate).toBeGreaterThan(0);
    });
  });

  describe("onSwitchToNewThread", () => {
    it("generates new threadId", () => {
      const store = createStore();
      const oldId = store.getState().threadId;
      store.getState().onSwitchToNewThread();
      expect(store.getState().threadId).not.toBe(oldId);
    });
  });

  describe("onSwitchToThread", () => {
    it("sets threadId to the given id", () => {
      const store = createStore();
      store.setState({ threads: [makeThread("t1")] });
      store.getState().onSwitchToThread("t1");
      expect(store.getState().threadId).toBe("t1");
    });
  });

  describe("onRenameThread", () => {
    it("renames thread in state and calls service", () => {
      const store = createStore();
      store.setState({ threads: [makeThread("t1", "Old")] });
      store.getState().onRenameThread("t1", "New Title");
      expect(store.getState().threads[0].title).toBe("New Title");
      expect(service.renameThread).toHaveBeenCalledWith("t1", "New Title");
    });
  });

  describe("onDeleteThread", () => {
    it("removes thread from state", () => {
      const store = createStore();
      store.setState({ threads: [makeThread("t1"), makeThread("t2")] });
      store.getState().onDeleteThread("t2");
      expect(store.getState().threads).toHaveLength(1);
      expect(service.deleteThread).toHaveBeenCalledWith("t2");
    });

    it("switches to new thread if deleting current", () => {
      const store = createStore();
      const currentId = store.getState().threadId;
      store.setState({
        threads: [makeThread(currentId)],
      });
      store.getState().onDeleteThread(currentId);
      expect(store.getState().threadId).not.toBe(currentId);
      expect(store.getState().threads).toHaveLength(0);
    });
  });

  describe("onClearThreadHistory", () => {
    it("clears history via service", async () => {
      const store = createStore();
      await store.getState().onClearThreadHistory("t1");
      expect(service.clearHistory).toHaveBeenCalledWith("t1");
    });

    it("clears messages if clearing current thread", async () => {
      const store = createStore();
      const currentId = store.getState().threadId;
      await store.getState().onClearThreadHistory(currentId);
      expect(messageStore.getState().clearMessages).toHaveBeenCalled();
    });
  });

  describe("onDownloadThread", () => {
    it("delegates to service", async () => {
      const store = createStore();
      store.setState({ threads: [makeThread("t1", "My Thread")] });
      await store.getState().onDownloadThread("t1");
      expect(service.downloadThread).toHaveBeenCalledWith("t1", "My Thread");
    });
  });
});
