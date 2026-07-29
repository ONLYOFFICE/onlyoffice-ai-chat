import type { Stores } from "../../store/create-stores";
import type { ProfilesStoreState } from "../../store/create-profiles-store";
import type Servers from "../../tools/servers";
import type { ChatEventBus } from "../EventsProvider";
import type { Profile } from "../../../types";
import type { ComposerBridge } from "./composer-bridge";
import type { AIChatWidgetRef } from "./types";

/**
 * Mutable holder for hook-derived callbacks that the imperative ref delegates to.
 * Updated on every render by `AppInner` so the ref always invokes the latest
 * closure (which has access to current React state and stores).
 */
export interface RefCallbacks {
  onNew: (text: string, files?: unknown[], images?: unknown[]) => void;
  approveToolCall: (allowAlways: boolean) => void;
  denyToolCall: () => void;
}

export function createWidgetRef(
  stores: Stores,
  selectCurrentChatProfile: (s: ProfilesStoreState) => Profile | null,
  callbacksRef: { current: RefCallbacks },
  _servers: Servers,
  eventBus: ChatEventBus,
  composerBridgeRef: { current: ComposerBridge }
): AIChatWidgetRef {
  // Resolve a thread's title for download/export. Prefers the in-memory
  // list; falls back to a storage read — with pagination the target may
  // not be in the loaded pages.
  const resolveThreadTitle = async (
    threadId: string
  ): Promise<string | undefined> => {
    const loaded = stores.useThreadsStore
      .getState()
      .threads.find((t) => t.threadId === threadId);
    if (loaded) return loaded.title;
    try {
      const stored = await stores.api.threads.getById(threadId);
      return stored?.title;
    } catch {
      return undefined;
    }
  };

  return {
    // --- Messages ---

    sendMessage(text, options) {
      callbacksRef.current.onNew(text, options?.files, options?.images);
    },

    setComposerText(text) {
      composerBridgeRef.current.setText?.(text);
    },

    stopStreaming() {
      stores.useMessageStore.getState().stopMessage();
    },

    isStreaming() {
      return stores.useMessageStore.getState().isStreamRunning;
    },

    // --- Threads ---

    switchThread(threadId) {
      stores.useThreadsStore.getState().onSwitchToThread(threadId);
    },

    createThread() {
      stores.useThreadsStore.getState().onSwitchToNewThread();
      return stores.useThreadsStore.getState().threadId;
    },

    deleteThread(threadId) {
      stores.useThreadsStore.getState().onDeleteThread(threadId);
    },

    renameThread(threadId, title) {
      stores.useThreadsStore.getState().onRenameThread(threadId, title);
    },

    async clearHistory(threadId) {
      await stores.useThreadsStore.getState().onClearThreadHistory(threadId);
    },

    downloadThread(threadId) {
      // With pagination the target thread may not be in the loaded pages
      // yet — recover its title from storage before exporting.
      void resolveThreadTitle(threadId).then((title) =>
        stores.useThreadsStore.getState().onDownloadThread(threadId, title)
      );
    },

    exportThread(threadId, formatId) {
      void resolveThreadTitle(threadId).then((title) =>
        stores.useThreadsStore
          .getState()
          .onExportThread(threadId, formatId, title)
      );
    },

    /**
     * Returns the threads currently loaded into the store. With
     * `enablePagination` this is the loaded pages, not necessarily the
     * whole collection.
     */
    getThreads() {
      return stores.useThreadsStore.getState().threads;
    },

    getCurrentThreadId() {
      return stores.useThreadsStore.getState().threadId;
    },

    // --- Navigation ---

    openChat() {
      stores.useRouter.getState().goToChat();
    },

    openSettings() {
      stores.useRouter.getState().goToSettings();
    },

    openHistory() {
      stores.useRouter.getState().setCurrentPage("history");
    },

    getCurrentPage() {
      return stores.useRouter.getState().currentPage;
    },

    // --- Profiles ---

    getProfiles() {
      return stores.useProfilesStore.getState().profiles;
    },

    setChatProfile(profileId) {
      const profile = stores.useProfilesStore
        .getState()
        .getProfileById(profileId);
      if (profile) {
        stores.useProfilesStore.getState().setChatProfile(profile);
      }
    },

    getCurrentProfile() {
      return selectCurrentChatProfile(stores.useProfilesStore.getState());
    },

    // --- Tool calls ---

    approveToolCall(options) {
      callbacksRef.current.approveToolCall(options?.allowAlways ?? false);
    },

    denyToolCall() {
      callbacksRef.current.denyToolCall();
    },

    // --- External updates ---

    async updateProfiles() {
      await stores.useProfilesStore.getState().reloadProfiles();
    },

    async updateThreads() {
      await stores.useThreadsStore.getState().initThreads();
    },

    updateCurrentChat() {
      stores.useProfilesStore.getState().reloadCurrentChat();
    },

    updateModelAssignment() {
      stores.useProfilesStore.getState().reloadModelAssignment();
    },

    async updateMCPServer() {
      await stores.useServersStore.getState().reload();
    },

    updateWebSearch() {
      // The active config lives in `storage.webSearch` now and is read
      // on demand by the settings page. Emitting `web-search-changed`
      // signals the page to re-sync from storage.
      eventBus.emit("web-search-changed");
    },

    updateExtendedThinking() {
      stores.useProfilesStore.getState().reloadExtendedThinking();
    },
  };
}
