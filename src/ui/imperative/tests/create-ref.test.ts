import { describe, expect, it, vi, beforeEach } from "vitest";

const { setSystemPromptAppendix, getSystemPromptAppendix } = vi.hoisted(() => ({
  setSystemPromptAppendix: vi.fn(),
  getSystemPromptAppendix: vi.fn(() => "appendix"),
}));

vi.mock("../../../core/providers/prompts", () => ({
  setSystemPromptAppendix,
  getSystemPromptAppendix,
}));

import { createWidgetRef } from "../create-ref";
import type { Stores } from "../../store/create-stores";
import type Servers from "../../tools/servers";
import type { ChatEventBus } from "../../providers/EventsProvider";

function makeStores() {
  const messageState = {
    stopMessage: vi.fn(),
    isStreamRunning: false,
  };
  const threadsState = {
    onSwitchToThread: vi.fn(),
    onSwitchToNewThread: vi.fn(),
    onDeleteThread: vi.fn(),
    onRenameThread: vi.fn(),
    onClearThreadHistory: vi.fn().mockResolvedValue(undefined),
    onDownloadThread: vi.fn().mockResolvedValue(undefined),
    threads: [{ threadId: "t1", title: "Title 1" }],
    threadId: "t1",
    initThreads: vi.fn().mockResolvedValue(undefined),
  };
  const routerState = {
    goToChat: vi.fn(),
    goToSettings: vi.fn(),
    setCurrentPage: vi.fn(),
    currentPage: "chat",
  };
  const profilesState = {
    profiles: [{ id: "p1", name: "P" }],
    getProfileById: vi.fn((id: string) =>
      id === "p1" ? { id: "p1", name: "P" } : null
    ),
    setChatProfile: vi.fn(),
    reloadProfiles: vi.fn().mockResolvedValue(undefined),
    reloadCurrentChat: vi.fn(),
    reloadModelAssignment: vi.fn(),
    reloadExtendedThinking: vi.fn(),
  };
  const serversState = {
    reload: vi.fn().mockResolvedValue(undefined),
  };

  return {
    states: {
      messageState,
      threadsState,
      routerState,
      profilesState,
      serversState,
    },
    stores: {
      useMessageStore: { getState: () => messageState },
      useThreadsStore: { getState: () => threadsState },
      useRouter: { getState: () => routerState },
      useProfilesStore: { getState: () => profilesState },
      useServersStore: { getState: () => serversState },
    } as unknown as Stores,
  };
}

describe("createWidgetRef", () => {
  beforeEach(() => vi.clearAllMocks());

  function build() {
    const { stores, states } = makeStores();
    const callbacks = {
      onNew: vi.fn(),
      approveToolCall: vi.fn(),
      denyToolCall: vi.fn(),
    };
    const callbacksRef = { current: callbacks };
    const select = vi.fn(
      () =>
        states.profilesState.profiles[0] as ReturnType<
          typeof states.profilesState.getProfileById
        >
    );
    const eventBus = { emit: vi.fn() } as unknown as ChatEventBus;
    const ref = createWidgetRef(
      stores,
      select,
      callbacksRef,
      {} as Servers,
      eventBus
    );
    return { ref, states, callbacks, eventBus };
  }

  it("sendMessage delegates to callbacks.onNew with options", () => {
    const { ref, callbacks } = build();
    ref.sendMessage("hi", { files: [], images: [] });
    expect(callbacks.onNew).toHaveBeenCalledWith("hi", [], []);
  });

  it("stopStreaming/isStreaming delegate to message store", () => {
    const { ref, states } = build();
    states.messageState.isStreamRunning = true;
    expect(ref.isStreaming()).toBe(true);
    ref.stopStreaming();
    expect(states.messageState.stopMessage).toHaveBeenCalled();
  });

  it("thread navigation delegates to threads store", () => {
    const { ref, states } = build();
    ref.switchThread("t1");
    expect(states.threadsState.onSwitchToThread).toHaveBeenCalledWith("t1");

    const id = ref.createThread();
    expect(states.threadsState.onSwitchToNewThread).toHaveBeenCalled();
    expect(id).toBe("t1");

    ref.deleteThread("t1");
    expect(states.threadsState.onDeleteThread).toHaveBeenCalledWith("t1");

    ref.renameThread("t1", "Renamed");
    expect(states.threadsState.onRenameThread).toHaveBeenCalledWith(
      "t1",
      "Renamed"
    );
  });

  it("clearHistory awaits threads store", async () => {
    const { ref, states } = build();
    await ref.clearHistory("t1");
    expect(states.threadsState.onClearThreadHistory).toHaveBeenCalledWith("t1");
  });

  it("downloadThread looks up title from threads", () => {
    const { ref, states } = build();
    ref.downloadThread("t1");
    expect(states.threadsState.onDownloadThread).toHaveBeenCalledWith(
      "t1",
      "Title 1"
    );
  });

  it("downloadThread passes undefined title for unknown thread", () => {
    const { ref, states } = build();
    ref.downloadThread("missing");
    expect(states.threadsState.onDownloadThread).toHaveBeenCalledWith(
      "missing",
      undefined
    );
  });

  it("getThreads / getCurrentThreadId expose state", () => {
    const { ref } = build();
    expect(ref.getThreads()).toEqual([{ threadId: "t1", title: "Title 1" }]);
    expect(ref.getCurrentThreadId()).toBe("t1");
  });

  it("navigation hooks open chat/settings/history", () => {
    const { ref, states } = build();
    ref.openChat();
    expect(states.routerState.goToChat).toHaveBeenCalled();
    ref.openSettings();
    expect(states.routerState.goToSettings).toHaveBeenCalled();
    ref.openHistory();
    expect(states.routerState.setCurrentPage).toHaveBeenCalledWith("history");
    expect(ref.getCurrentPage()).toBe("chat");
  });

  it("getProfiles / setChatProfile / getCurrentProfile work", () => {
    const { ref, states } = build();
    expect(ref.getProfiles()).toEqual(states.profilesState.profiles);
    ref.setChatProfile("p1");
    expect(states.profilesState.setChatProfile).toHaveBeenCalled();
    ref.setChatProfile("missing");
    expect(states.profilesState.setChatProfile).toHaveBeenCalledTimes(1);
    expect(ref.getCurrentProfile()).toEqual({ id: "p1", name: "P" });
  });

  it("approveToolCall/denyToolCall delegate to callbacksRef", () => {
    const { ref, callbacks } = build();
    ref.approveToolCall({ allowAlways: true });
    expect(callbacks.approveToolCall).toHaveBeenCalledWith(true);
    ref.approveToolCall();
    expect(callbacks.approveToolCall).toHaveBeenLastCalledWith(false);
    ref.denyToolCall();
    expect(callbacks.denyToolCall).toHaveBeenCalled();
  });

  it("update* methods refresh stores", async () => {
    const { ref, states } = build();
    await ref.updateProfiles();
    expect(states.profilesState.reloadProfiles).toHaveBeenCalled();
    await ref.updateThreads();
    expect(states.threadsState.initThreads).toHaveBeenCalled();
    ref.updateCurrentChat();
    expect(states.profilesState.reloadCurrentChat).toHaveBeenCalled();
    ref.updateModelAssignment();
    expect(states.profilesState.reloadModelAssignment).toHaveBeenCalled();
    await ref.updateMCPServer();
    expect(states.serversState.reload).toHaveBeenCalled();
    ref.updateExtendedThinking();
    expect(states.profilesState.reloadExtendedThinking).toHaveBeenCalled();
  });

  it("updateWebSearch emits web-search-changed", () => {
    const { ref, eventBus } = build();
    ref.updateWebSearch();
    expect(eventBus.emit).toHaveBeenCalledWith("web-search-changed");
  });

  it("system prompt appendix get/set/clear/update", () => {
    const { ref } = build();
    ref.setSystemPromptAppendix("yo");
    expect(setSystemPromptAppendix).toHaveBeenCalledWith("yo");
    ref.clearSystemPromptAppendix();
    expect(setSystemPromptAppendix).toHaveBeenLastCalledWith("");
    expect(ref.getSystemPromptAppendix()).toBe("appendix");
    ref.updateSystemPromptAppendix(); // no-op shouldn't throw
  });
});
