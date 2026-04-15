import type { Stores } from "../store/create-stores";
import type { ProfilesStoreState } from "../store/create-profiles-store";
import type { Profile } from "../types";
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
  callbacksRef: { current: RefCallbacks }
): AIChatWidgetRef {
  return {
    // --- Messages ---

    sendMessage(text, options) {
      callbacksRef.current.onNew(text, options?.files, options?.images);
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
      stores.useThreadsStore.getState().onDownloadThread(threadId);
    },

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
  };
}
