import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { CallbacksManager } from "../events";
import type { PlatformAdapter } from "../platform/types";
import type { ServerAPI } from "../providers/ApiProvider";
import type { Thread } from "../../types";
import { convertMessagesToMd, removeSpecialCharacter } from "../../utils";
import type { MessageStoreState } from "./create-message-store";
import type { ProfilesStoreState } from "./create-profiles-store";

/**
 * Zustand state for conversation threads.
 *
 * Manages the list of threads, the currently active thread ID, and all
 * operations for creating, switching, renaming, deleting, and clearing
 * threads.
 */
export interface ThreadsStoreState {
  /** ID of the currently active thread (empty string when no thread is selected). */
  threadId: string;
  /** All persisted threads, ordered most-recent first. */
  threads: Thread[];
  /** Load all threads from persistent storage. */
  initThreads: () => Promise<void>;
  /**
   * Register a thread that the core engine has already persisted (for
   * example, a fresh thread created by `AIEngine.sendWithThread`):
   * loads it from storage by id, switches to it, and prepends it to
   * the list. Does not create a new storage record.
   */
  insertThread: (
    threadId: string,
    title: string,
    opts?: { profileId?: string }
  ) => Promise<void>;
  /** Bump current thread's last-edit timestamp (called when a new message is sent). */
  insertNewMessageToThread: (opts?: { profileId?: string }) => Promise<void>;
  /** Create a fresh empty thread placeholder and switch to it. */
  onSwitchToNewThread: () => void;
  /** Switch to an existing thread by ID. */
  onSwitchToThread: (id: string) => void;
  /** Download the thread conversation as a `.docx` file via the platform file adapter. */
  onDownloadThread: (id: string, title?: string) => Promise<void>;
  /** Rename a thread and persist the change. */
  onRenameThread: (id: string, title: string) => Promise<void>;
  /** Delete a thread; if it is the active thread, switches to a new one first. */
  onDeleteThread: (id: string) => Promise<void>;
  /** Clear all messages in a thread without deleting the thread itself. */
  onClearThreadHistory: (id: string) => Promise<void>;
}

export function createThreadsStore(deps: {
  api: ServerAPI;
  platform: PlatformAdapter;
  useProfilesStore: UseBoundStore<StoreApi<ProfilesStoreState>>;
  useMessageStore: UseBoundStore<StoreApi<MessageStoreState>>;
  callbacksManager: CallbacksManager;
}): UseBoundStore<StoreApi<ThreadsStoreState>> {
  const { api, platform, useProfilesStore, useMessageStore, callbacksManager } =
    deps;

  const applyThreadContextFromThread = (thread?: Thread) => {
    const { getProfileById, setSessionChatProfile } =
      useProfilesStore.getState();
    const profile = thread?.profileId ? getProfileById(thread.profileId) : null;
    setSessionChatProfile(profile);
  };

  return create<ThreadsStoreState>((set, get) => ({
    threadId: "",
    threads: [],

    initThreads: async () => {
      const threads = await api.threads.list();
      set({ threads });
    },

    insertThread: async (threadId, title, opts) => {
      const existing = await api.threads.getById(threadId);
      const thread = existing ?? {
        threadId,
        title,
        lastEditDate: Date.now(),
        profileId: opts?.profileId,
      };
      set((state) => ({
        threadId,
        threads: [
          thread,
          ...state.threads.filter((t) => t.threadId !== threadId),
        ],
      }));
      callbacksManager.emit("onThreadsUpdated", {
        kind: "created",
        threadId: thread.threadId,
        title,
      });
    },

    insertNewMessageToThread: async (opts) => {
      const { threadId, threads } = get();
      if (!threadId) return;
      await api.threads.touch(threadId, opts?.profileId);
      set({
        threads: threads.map((thread) => {
          if (thread.threadId === threadId) {
            return {
              ...thread,
              ...(opts && "profileId" in opts
                ? { profileId: opts.profileId }
                : {}),
              lastEditDate: Date.now(),
            };
          }
          return thread;
        }),
      });
    },

    onSwitchToNewThread: () => {
      const previousThreadId = get().threadId;
      applyThreadContextFromThread(undefined);
      set({ threadId: "" });
      callbacksManager.emit("onThreadsUpdated", {
        kind: "switched",
        threadId: "",
        previousThreadId,
      });
    },

    onSwitchToThread: (id) => {
      const previousThreadId = get().threadId;
      const thread = get().threads.find((t) => t.threadId === id);
      applyThreadContextFromThread(thread);
      set({ threadId: id });
      callbacksManager.emit("onThreadsUpdated", {
        kind: "switched",
        threadId: id,
        previousThreadId,
      });
    },

    onDownloadThread: async (id, title) => {
      const messages = await api.threads.readMessages(id);
      const fileName = removeSpecialCharacter(title || "Chat Export");
      const content = convertMessagesToMd(messages);
      platform.file?.saveAsFile(content, `${fileName}.docx`);
    },

    onRenameThread: async (id, title) => {
      set({
        threads: get().threads.map((thread) =>
          thread.threadId === id ? { ...thread, title } : thread
        ),
      });
      await api.threads.rename(id, title);
      callbacksManager.emit("onThreadsUpdated", {
        kind: "renamed",
        threadId: id,
        title,
        isAutoGenerated: false,
      });
    },

    onDeleteThread: async (id) => {
      const thisStore = get();
      if (thisStore.threadId === id) {
        thisStore.onSwitchToNewThread();
      }
      set({
        threads: thisStore.threads.filter((t) => t.threadId !== id),
      });
      await api.threads.delete(id);
      callbacksManager.emit("onThreadsUpdated", {
        kind: "deleted",
        threadId: id,
      });
    },

    onClearThreadHistory: async (id) => {
      await api.threads.clearMessages(id);
      if (get().threadId === id) {
        useMessageStore.getState().clearMessages();
      }
      callbacksManager.emit("onThreadsUpdated", {
        kind: "cleared",
        threadId: id,
      });
    },
  }));
}
