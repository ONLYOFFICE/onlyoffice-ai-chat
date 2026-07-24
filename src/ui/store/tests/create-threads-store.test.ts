import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallbacksManager } from "../../providers/EventsProvider";
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
  const useMessageStore = {
    getState: () => ({ clearMessages, claimThreadId, fetchPrevMessages }),
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
