import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallbacksManager } from "../../providers/EventsProvider";

// The store reads the default export filename from the i18next singleton,
// which is never initialized in unit tests — resolve the key manually.
vi.mock("i18next", () => ({
  default: {
    t: (key: string) => (key === "ChatExport" ? "Chat Export" : key),
  },
}));
import type { PlatformAdapter } from "../../providers/PlatformProvider/types";
import type { ServerAPI } from "../../providers/ApiProvider";
import { createThreadsStore } from "../create-threads-store";
import type { MessageStoreState } from "../create-message-store";
import type { ProfilesStoreState } from "../create-profiles-store";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Thread } from "../../../types";

type ProfilesStore = UseBoundStore<StoreApi<ProfilesStoreState>>;
type MessageStore = UseBoundStore<StoreApi<MessageStoreState>>;

function makeDeps(initialThreads: Thread[] = []) {
  const profilesGetState = vi.fn(() => ({
    getProfileById: vi.fn((id: string) => ({ id, name: `p-${id}` })),
    setSessionChatProfile: vi.fn(),
  }));
  const useProfilesStore = {
    getState: profilesGetState,
  } as unknown as ProfilesStore;

  const clearMessages = vi.fn();
  const claimThreadId = vi.fn();
  const fetchPrevMessages = vi.fn().mockResolvedValue(undefined);
  const orphanStreams = vi.fn();
  const useMessageStore = {
    getState: () => ({
      clearMessages,
      claimThreadId,
      fetchPrevMessages,
      orphanStreams,
    }),
  } as unknown as MessageStore;

  const api = {
    threads: {
      list: vi.fn().mockResolvedValue(initialThreads),
      getById: vi.fn().mockResolvedValue(null),
      touch: vi.fn().mockResolvedValue(undefined),
      readMessages: vi.fn().mockResolvedValue([]),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clearMessages: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as ServerAPI;

  const saveAsFile = vi.fn();
  const getExportFormats = vi.fn(() => [
    { id: "docx", label: "Word (.docx)", extension: "docx" },
    { id: "pdf", label: "PDF (.pdf)", extension: "pdf" },
  ]);
  const platform = {
    file: { saveAsFile, getExportFormats },
  } as unknown as PlatformAdapter;

  const callbacksManager = { emit: vi.fn() } as unknown as CallbacksManager;
  return {
    api,
    platform,
    useProfilesStore,
    useMessageStore,
    callbacksManager,
    profilesGetState,
    clearMessages,
    claimThreadId,
    fetchPrevMessages,
    orphanStreams,
    saveAsFile,
    getExportFormats,
  };
}

const mkThread = (id: string, title = `t-${id}`): Thread =>
  ({ threadId: id, title, lastEditDate: 1, profileId: undefined }) as Thread;

describe("createThreadsStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts empty", () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    expect(s.getState().threadId).toBe("");
    expect(s.getState().threads).toEqual([]);
  });

  it("initThreads loads from api", async () => {
    const deps = makeDeps([mkThread("a"), mkThread("b")]);
    const s = createThreadsStore(deps);
    await s.getState().initThreads();
    expect(s.getState().threads).toHaveLength(2);
  });

  it("initThreads reports a failed load on onError and keeps the list", async () => {
    const deps = makeDeps([mkThread("a")]);
    const s = createThreadsStore(deps);
    await s.getState().initThreads();

    const failure = new Error("offline");
    deps.api.threads.list = vi.fn().mockRejectedValue(failure);
    await expect(s.getState().initThreads()).resolves.toBeUndefined();

    expect(deps.callbacksManager.emit).toHaveBeenCalledWith("onError", {
      type: "storage",
      error: failure,
      context: "threads:init",
    });
    expect(s.getState().threads).toHaveLength(1);
  });

  it("initThreads forwards entityId to api.threads.list", async () => {
    const deps = makeDeps([mkThread("a")]);
    const s = createThreadsStore(deps);
    await s.getState().initThreads("e1");
    expect(deps.api.threads.list).toHaveBeenCalledWith("e1");
  });

  it("initThreads passes undefined entityId in passthrough mode", async () => {
    const deps = makeDeps([mkThread("a")]);
    const s = createThreadsStore(deps);
    await s.getState().initThreads();
    expect(deps.api.threads.list).toHaveBeenCalledWith(undefined);
  });

  it("insertThread uses existing thread when found", async () => {
    const deps = makeDeps();
    deps.api.threads.getById = vi
      .fn()
      .mockResolvedValue(mkThread("a", "old-title"));
    const s = createThreadsStore(deps);
    await s.getState().insertThread("a", "ignored-title");
    expect(s.getState().threadId).toBe("a");
    expect(s.getState().threads[0].title).toBe("old-title");
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
      "onThreadsUpdated",
      { kind: "created", threadId: "a", title: "ignored-title" }
    );
  });

  it("insertThread creates placeholder when not in storage", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    await s.getState().insertThread("z", "new-title", { profileId: "p1" });
    expect(s.getState().threads[0].threadId).toBe("z");
    expect(s.getState().threads[0].title).toBe("new-title");
  });

  it("insertThread dedupes existing entry", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threads: [mkThread("a"), mkThread("b")] });
    await s.getState().insertThread("a", "fresh");
    expect(s.getState().threads.map((t) => t.threadId)).toEqual(["a", "b"]);
  });

  it("insertNewMessageToThread no-ops when no active thread", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    await s.getState().insertNewMessageToThread();
    expect(deps.api.threads.touch).not.toHaveBeenCalled();
  });

  it("insertNewMessageToThread bumps lastEdit and updates profileId", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threadId: "a", threads: [mkThread("a")] });
    await s
      .getState()
      .insertNewMessageToThread({ profileId: "p2" } as { profileId: string });
    expect(deps.api.threads.touch).toHaveBeenCalledWith("a", "p2");
    expect(s.getState().threads[0].profileId).toBe("p2");
  });

  it("onSwitchToNewThread clears threadId, resets messages, and emits", () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threadId: "a" });
    s.getState().onSwitchToNewThread();
    expect(s.getState().threadId).toBe("");
    // In-flight rounds must be detached BEFORE the list is reset, so
    // they can't write their tail into the fresh (empty) chat.
    expect(deps.orphanStreams).toHaveBeenCalled();
    expect(deps.claimThreadId).toHaveBeenCalledWith("");
    expect(deps.clearMessages).toHaveBeenCalled();
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
      "onThreadsUpdated",
      { kind: "switched", threadId: "", previousThreadId: "a" }
    );
  });

  it("onSwitchToNewThread keeps the session profile when asked", () => {
    const deps = makeDeps();
    const setSessionChatProfile = vi.fn();
    deps.profilesGetState.mockReturnValue({
      getProfileById: vi.fn((id: string) => ({ id, name: `p-${id}` })),
      setSessionChatProfile,
    });
    const s = createThreadsStore(deps);
    s.setState({ threadId: "a" });

    s.getState().onSwitchToNewThread({ keepSessionProfile: true });
    expect(s.getState().threadId).toBe("");
    expect(setSessionChatProfile).not.toHaveBeenCalled();

    s.setState({ threadId: "b" });
    s.getState().onSwitchToNewThread();
    expect(setSessionChatProfile).toHaveBeenCalledWith(null);
  });

  it("onSwitchToThread sets threadId, loads messages, and emits", () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threads: [mkThread("a")] });
    s.getState().onSwitchToThread("a");
    expect(s.getState().threadId).toBe("a");
    expect(deps.fetchPrevMessages).toHaveBeenCalledWith("a");
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
      "onThreadsUpdated",
      { kind: "switched", threadId: "a", previousThreadId: "" }
    );
  });

  it("onDownloadThread fetches messages and saves via platform", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    await s.getState().onDownloadThread("a", "My Chat");
    expect(deps.api.threads.readMessages).toHaveBeenCalledWith("a");
    expect(deps.saveAsFile).toHaveBeenCalledWith(
      expect.any(String),
      "My Chat.docx"
    );
  });

  it("onDownloadThread defaults filename when title is empty", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    await s.getState().onDownloadThread("a");
    expect(deps.saveAsFile).toHaveBeenCalledWith(
      expect.any(String),
      "Chat Export.docx"
    );
  });

  it("onExportThread resolves extension by formatId and passes format through", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    await s.getState().onExportThread("a", "pdf", "My Chat");
    expect(deps.api.threads.readMessages).toHaveBeenCalledWith("a");
    expect(deps.saveAsFile).toHaveBeenCalledWith(
      expect.any(String),
      "My Chat.pdf",
      "pdf"
    );
  });

  it("onExportThread falls back to docx for an unknown formatId", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    await s.getState().onExportThread("a", "unknown", "My Chat");
    expect(deps.saveAsFile).toHaveBeenCalledWith(
      expect.any(String),
      "My Chat.docx",
      "unknown"
    );
  });

  it("onRenameThread updates title and persists", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threads: [mkThread("a", "old")] });
    await s.getState().onRenameThread("a", "renamed");
    expect(s.getState().threads[0].title).toBe("renamed");
    expect(deps.api.threads.rename).toHaveBeenCalledWith("a", "renamed");
  });

  it("onDeleteThread switches to new when deleting active thread", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threadId: "a", threads: [mkThread("a"), mkThread("b")] });
    await s.getState().onDeleteThread("a");
    expect(s.getState().threadId).toBe("");
    expect(s.getState().threads.map((t) => t.threadId)).toEqual(["b"]);
    expect(deps.api.threads.delete).toHaveBeenCalledWith("a");
  });

  it("onDeleteThread leaves active id when deleting other thread", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threadId: "a", threads: [mkThread("a"), mkThread("b")] });
    await s.getState().onDeleteThread("b");
    expect(s.getState().threadId).toBe("a");
  });

  it("onClearThreadHistory clears messages when active matches", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threadId: "a" });
    await s.getState().onClearThreadHistory("a");
    expect(deps.api.threads.clearMessages).toHaveBeenCalledWith("a");
    expect(deps.clearMessages).toHaveBeenCalled();
  });

  it("onClearThreadHistory leaves messages alone when not active", async () => {
    const deps = makeDeps();
    const s = createThreadsStore(deps);
    s.setState({ threadId: "other" });
    await s.getState().onClearThreadHistory("a");
    expect(deps.clearMessages).not.toHaveBeenCalled();
  });
});

describe("createThreadsStore pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  const dataset = (n: number): Thread[] =>
    Array.from({ length: n }, (_, i) => ({
      threadId: `t${i}`,
      title: `Thread ${i}`,
      lastEditDate: 100000 - i,
    }));

  /** api.threads.list mock honoring (entityId, count, cursor). */
  const pagedList = (all: Thread[]) =>
    vi.fn(
      async (
        _entityId?: string,
        count?: number,
        cursor?: { threadId: string }
      ) => {
        const from = cursor
          ? all.findIndex((t) => t.threadId === cursor.threadId) + 1
          : 0;
        return all.slice(from, count ? from + count : undefined);
      }
    );

  const buildPaged = (all: Thread[]) => {
    const deps = makeDeps();
    deps.api.threads.list = pagedList(all) as never;
    const store = createThreadsStore({ ...deps, getPagination: () => true });
    return { deps, store };
  };

  it("initThreads loads the first page and flags hasMoreThreads", async () => {
    const { deps, store } = buildPaged(dataset(250));
    await store.getState().initThreads("e1");
    expect(deps.api.threads.list).toHaveBeenCalledWith("e1", 100);
    expect(store.getState().threads).toHaveLength(100);
    expect(store.getState().hasMoreThreads).toBe(true);
  });

  it("initThreads with a short first page reports no more", async () => {
    const { store } = buildPaged(dataset(30));
    await store.getState().initThreads();
    expect(store.getState().threads).toHaveLength(30);
    expect(store.getState().hasMoreThreads).toBe(false);
  });

  it("loadMoreThreads appends the next page via the tail cursor", async () => {
    const { deps, store } = buildPaged(dataset(250));
    await store.getState().initThreads("e1");
    await store.getState().loadMoreThreads();
    expect(deps.api.threads.list).toHaveBeenLastCalledWith("e1", 100, {
      lastEditDate: 100000 - 99,
      threadId: "t99",
      id: "t99",
    });
    expect(store.getState().threads).toHaveLength(200);
    expect(store.getState().hasMoreThreads).toBe(true);

    await store.getState().loadMoreThreads();
    expect(store.getState().threads).toHaveLength(250);
    expect(store.getState().hasMoreThreads).toBe(false);
  });

  it("loadMoreThreads dedups threads that reappear after a window shift", async () => {
    const all = dataset(150);
    const { deps, store } = buildPaged(all);
    await store.getState().initThreads();
    // Simulate an insert that shifted the window: page 2 re-serves t99.
    deps.api.threads.list = vi
      .fn()
      .mockResolvedValue(all.slice(99, 150)) as never;
    await store.getState().loadMoreThreads();
    const ids = store.getState().threads.map((t) => t.threadId);
    expect(ids).toHaveLength(150);
    expect(new Set(ids).size).toBe(150);
  });

  it("loadMoreThreads stops when a backend ignores the cursor", async () => {
    const all = dataset(100);
    const { deps, store } = buildPaged(all);
    await store.getState().initThreads();
    expect(store.getState().hasMoreThreads).toBe(true);
    // A legacy backend keeps returning the same first page.
    deps.api.threads.list = vi.fn().mockResolvedValue(all) as never;
    await store.getState().loadMoreThreads();
    // Nothing new arrived — paging must stop instead of looping.
    expect(store.getState().threads).toHaveLength(100);
    expect(store.getState().hasMoreThreads).toBe(false);
  });

  it("ensureAllThreads drains every remaining page", async () => {
    const { store } = buildPaged(dataset(350));
    await store.getState().initThreads();
    await store.getState().ensureAllThreads();
    expect(store.getState().threads).toHaveLength(350);
    expect(store.getState().hasMoreThreads).toBe(false);
  });

  it("ensureAllThreads shares an already in-flight page instead of spinning", async () => {
    const all = dataset(200);
    const deps = makeDeps();
    let releasePage2!: (v: Thread[]) => void;
    let call = 0;
    deps.api.threads.list = vi.fn(async (..._args: unknown[]) => {
      call++;
      if (call === 1) return all.slice(0, 100);
      // Page 2 hangs until we release it — while it is on the wire,
      // ensureAllThreads must AWAIT it, not busy-loop past the guard.
      if (call === 2) return new Promise<Thread[]>((r) => (releasePage2 = r));
      return [];
    }) as never;
    const store = createThreadsStore({ ...deps, getPagination: () => true });
    await store.getState().initThreads();

    const scrollTriggered = store.getState().loadMoreThreads();
    const searchTriggered = store.getState().ensureAllThreads();
    // Only the shared in-flight request exists — no duplicate fetch.
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.api.threads.list).toHaveBeenCalledTimes(2);

    releasePage2(all.slice(100, 200));
    await Promise.all([scrollTriggered, searchTriggered]);
    expect(store.getState().threads).toHaveLength(200);
    expect(store.getState().hasMoreThreads).toBe(false);
  });

  it("searchThreads sends the query to storage and pages the matches", async () => {
    const all = dataset(300).map((t, i) =>
      i % 2 === 0 ? { ...t, title: `Report ${i}` } : t
    );
    const deps = makeDeps();
    deps.api.threads.list = vi.fn(
      async (
        _entityId?: string,
        count?: number,
        cursor?: { threadId: string },
        query?: string
      ) => {
        const matches = query
          ? all.filter((t) =>
              t.title!.toLowerCase().includes(query.toLowerCase())
            )
          : all;
        const from = cursor
          ? matches.findIndex((t) => t.threadId === cursor.threadId) + 1
          : 0;
        return matches.slice(from, count ? from + count : undefined);
      }
    ) as never;
    const store = createThreadsStore({ ...deps, getPagination: () => true });
    await store.getState().initThreads("e1");

    await store.getState().searchThreads("report");
    expect(deps.api.threads.list).toHaveBeenLastCalledWith(
      "e1",
      100,
      undefined,
      "report"
    );
    expect(store.getState().searchResults).toHaveLength(100);
    expect(store.getState().hasMoreSearchResults).toBe(true);

    await store.getState().loadMoreSearchResults();
    // 150 matches total → 100 + 50.
    expect(store.getState().searchResults).toHaveLength(150);
    expect(store.getState().hasMoreSearchResults).toBe(false);
    const lastCall = (
      deps.api.threads.list as ReturnType<typeof vi.fn>
    ).mock.calls.at(-1)!;
    expect(lastCall[3]).toBe("report");
    expect(lastCall[2]).toMatchObject({ threadId: expect.any(String) });
  });

  it("an empty query resets the search state", async () => {
    const { store } = buildPaged(dataset(150));
    await store.getState().initThreads();
    store.setState({ searchResults: [dataset(1)[0]] });
    await store.getState().searchThreads("");
    expect(store.getState().searchResults).toBeNull();
    expect(store.getState().hasMoreSearchResults).toBe(false);
  });

  it("falls back to the full drain when the backend ignores the query", async () => {
    const all = dataset(150);
    const deps = makeDeps();
    // A legacy backend: returns plain pages regardless of `query`.
    deps.api.threads.list = pagedList(all) as never;
    const store = createThreadsStore({ ...deps, getPagination: () => true });
    await store.getState().initThreads();

    await store.getState().searchThreads("zzz-no-match");
    // The response contained non-matching titles ⇒ query unsupported:
    // no server results, and the whole collection was drained for the
    // client-side filter instead.
    expect(store.getState().searchResults).toBeNull();
    expect(store.getState().threads).toHaveLength(150);
    expect(store.getState().hasMoreThreads).toBe(false);

    // Later searches skip the probe — no more `query` on the wire.
    const callsBefore = (deps.api.threads.list as ReturnType<typeof vi.fn>).mock
      .calls.length;
    await store.getState().searchThreads("another");
    const newCalls = (
      deps.api.threads.list as ReturnType<typeof vi.fn>
    ).mock.calls.slice(callsBefore);
    expect(newCalls.every((c) => c[3] === undefined)).toBe(true);
  });

  it("a stale search response never overwrites a newer query", async () => {
    const deps = makeDeps();
    const resolvers: ((v: Thread[]) => void)[] = [];
    deps.api.threads.list = vi.fn(async (..._args: unknown[]) => {
      if (
        (deps.api.threads.list as ReturnType<typeof vi.fn>).mock.calls
          .length === 1
      ) {
        return []; // initThreads
      }
      return new Promise<Thread[]>((r) => resolvers.push(r));
    }) as never;
    const store = createThreadsStore({ ...deps, getPagination: () => true });
    await store.getState().initThreads();

    const first = store.getState().searchThreads("alp");
    const second = store.getState().searchThreads("alpha");
    // The SECOND (current) query resolves first…
    resolvers[1]([{ threadId: "m2", title: "alpha match" }]);
    await second;
    // …then the stale first response lands and must be discarded.
    resolvers[0]([{ threadId: "m1", title: "alp stale" }]);
    await first;
    expect(store.getState().searchResults).toEqual([
      { threadId: "m2", title: "alpha match" },
    ]);
  });

  it("searchThreads is a no-op when pagination is off", async () => {
    const deps = makeDeps([mkThread("a")]);
    const store = createThreadsStore({ ...deps, getPagination: () => false });
    await store.getState().searchThreads("anything");
    expect(deps.api.threads.list).not.toHaveBeenCalled();
    expect(store.getState().searchResults).toBeNull();
  });

  it("delete and rename keep an active search view in step", async () => {
    const { store } = buildPaged(dataset(150));
    await store.getState().initThreads();
    store.setState({
      searchResults: [
        { threadId: "t1", title: "One" },
        { threadId: "t2", title: "Two" },
      ],
    });
    await store.getState().onRenameThread("t1", "Renamed");
    expect(store.getState().searchResults?.[0].title).toBe("Renamed");
    await store.getState().onDeleteThread("t2");
    expect(store.getState().searchResults).toEqual([
      { threadId: "t1", title: "Renamed" },
    ]);
  });

  it("a failing page aborts the drain instead of hammering the backend", async () => {
    const all = dataset(300);
    const deps = makeDeps();
    let call = 0;
    deps.api.threads.list = vi.fn(async () => {
      call++;
      if (call === 1) return all.slice(0, 100);
      throw new Error("network down");
    }) as never;
    const store = createThreadsStore({ ...deps, getPagination: () => true });
    await store.getState().initThreads();
    await expect(store.getState().ensureAllThreads()).rejects.toThrow(
      "network down"
    );
    // Exactly one failed page attempt — the drain loop must not retry
    // a permanently failing backend forever.
    expect(deps.api.threads.list).toHaveBeenCalledTimes(2);
    expect(store.getState().isLoadingMoreThreads).toBe(false);
  });

  it("initThreads keeps the unbounded single call when the flag is off", async () => {
    const deps = makeDeps([mkThread("a")]);
    const store = createThreadsStore({ ...deps, getPagination: () => false });
    await store.getState().initThreads("e1");
    expect(deps.api.threads.list).toHaveBeenCalledWith("e1");
    expect(store.getState().hasMoreThreads).toBe(false);
    await store.getState().loadMoreThreads();
    expect(deps.api.threads.list).toHaveBeenCalledTimes(1);
  });

  it("onSwitchToThread recovers the profile binding from storage for an unloaded thread", async () => {
    const { deps, store } = buildPaged(dataset(150));
    await store.getState().initThreads();
    deps.api.threads.getById = vi.fn().mockResolvedValue({
      threadId: "t120",
      title: "Unloaded",
      profileId: "p9",
    }) as never;
    store.getState().onSwitchToThread("t120");
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.api.threads.getById).toHaveBeenCalledWith("t120");
    const profilesState = deps.profilesGetState.mock.results.at(-1)
      ?.value as ReturnType<typeof deps.profilesGetState>;
    expect(profilesState.setSessionChatProfile).toHaveBeenCalled();
  });

  it("onDownloadThread drains messages in pages when the flag is on", async () => {
    const { deps, store } = buildPaged(dataset(1));
    const history = Array.from({ length: 150 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
      id: `m${i}`,
      createdAt: new Date(1000 + i),
    }));
    deps.api.threads.readMessages = vi.fn(
      async (_t: string, count?: number, cursor?: { id: string }) => {
        const from = cursor
          ? history.findIndex((m) => m.id === cursor.id) + 1
          : 0;
        return history.slice(from, count ? from + count : undefined);
      }
    ) as never;
    await store.getState().onDownloadThread("t0", "Title");
    expect(deps.api.threads.readMessages).toHaveBeenCalledTimes(2);
    expect(deps.api.threads.readMessages).toHaveBeenNthCalledWith(
      1,
      "t0",
      100,
      undefined
    );
    expect(deps.saveAsFile).toHaveBeenCalled();
  });
});
