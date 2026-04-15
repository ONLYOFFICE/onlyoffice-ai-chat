import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { CallbacksManager } from "../events/callbacks";
import type { ThreadsService } from "../services/threads";
import type { Profile, Thread } from "../types";
import type { MessageStoreState } from "./create-message-store";
import type { ProfilesStoreState } from "./create-profiles-store";

/**
 * Zustand state for conversation threads.
 *
 * Manages the list of threads, the currently active thread ID, and all
 * operations for creating, switching, renaming, downloading, deleting,
 * and clearing threads.
 */
export interface ThreadsStoreState {
  /** ID of the currently active thread. */
  threadId: string;
  /** All persisted threads, ordered most-recent first. */
  threads: Thread[];
  /** Load all threads from persistent storage. */
  initThreads: () => Promise<void>;
  /** Create a new thread with the given title and optionally bind it to a profile. */
  insertThread: (title: string, opts?: { profileId?: string }) => void;
  /** Update the current thread's last-edit timestamp (called when a new message is sent). */
  insertNewMessageToThread: (opts?: { profileId?: string }) => void;
  /** Migrate a legacy thread that stored provider/model directly to the profile-based format. */
  migrateThreadFromProviderModelToProfile: (thread: Thread) => Thread;
  /** Create a fresh empty thread and switch to it. */
  onSwitchToNewThread: () => void;
  /** Switch to an existing thread by ID, migrating it if necessary. */
  onSwitchToThread: (id: string) => void;
  /** Download the full thread conversation as a file. */
  onDownloadThread: (id: string) => void;
  /** Rename a thread and persist the change. */
  onRenameThread: (id: string, title: string) => void;
  /** Delete a thread; if it is the active thread, switches to a new one first. */
  onDeleteThread: (id: string) => void;
  /** Clear all messages in a thread without deleting the thread itself. */
  onClearThreadHistory: (id: string) => void;
}

export function createThreadsStore(deps: {
  threadsService: ThreadsService;
  useProfilesStore: UseBoundStore<StoreApi<ProfilesStoreState>>;
  useMessageStore: UseBoundStore<StoreApi<MessageStoreState>>;
  callbacksManager: CallbacksManager;
}): UseBoundStore<StoreApi<ThreadsStoreState>> {
  const {
    threadsService,
    useProfilesStore,
    useMessageStore,
    callbacksManager,
  } = deps;

  const needsMigrationToProfile = (
    thread: Thread | undefined
  ): thread is Thread => !!(thread?.provider || thread?.model);

  const applyThreadContextFromThread = (thread?: Thread) => {
    const { getProfileById, setSessionChatProfile } =
      useProfilesStore.getState();
    const profile = thread?.profileId ? getProfileById(thread.profileId) : null;
    setSessionChatProfile(profile);
  };

  return create<ThreadsStoreState>((set, get) => ({
    threadId: crypto.randomUUID(),
    threads: [],

    initThreads: async () => {
      const threads = await threadsService.loadAll();
      set({ threads });
    },

    insertThread: (title, opts) => {
      const { threadId, threads } = get();
      const thread = threadsService.createThread(
        threadId,
        title,
        opts?.profileId
      );
      set({ threads: [thread, ...threads] });
      callbacksManager.emit("onThreadCreated", { threadId, title });
    },

    insertNewMessageToThread: (opts) => {
      const { threadId, threads } = get();
      threadsService.touchThread(threadId, opts);
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

    migrateThreadFromProviderModelToProfile: (thread) => {
      const { profiles, chatProfile, defaultProfile } =
        useProfilesStore.getState();
      const migratedThread = threadsService.migrateThreadToProfile(
        thread,
        profiles,
        chatProfile as Profile | null,
        defaultProfile as Profile | null
      );
      set((state) => ({
        threads: state.threads.map((t) =>
          t.threadId === thread.threadId ? migratedThread : t
        ),
      }));
      return migratedThread;
    },

    onSwitchToNewThread: () => {
      const previousThreadId = get().threadId;
      applyThreadContextFromThread(undefined);
      const newThreadId = crypto.randomUUID();
      set({ threadId: newThreadId });
      callbacksManager.emit("onThreadSwitched", {
        threadId: newThreadId,
        previousThreadId,
      });
    },

    onSwitchToThread: (id) => {
      const previousThreadId = get().threadId;
      const { threads, migrateThreadFromProviderModelToProfile } = get();
      let thread = threads.find((t) => t.threadId === id);
      if (needsMigrationToProfile(thread)) {
        thread = migrateThreadFromProviderModelToProfile(thread);
      }
      applyThreadContextFromThread(thread);
      set({ threadId: id });
      callbacksManager.emit("onThreadSwitched", {
        threadId: id,
        previousThreadId,
      });
    },

    onDownloadThread: async (id) => {
      const thread = get().threads.find((t) => t.threadId === id);
      await threadsService.downloadThread(id, thread?.title);
    },

    onRenameThread: (id, title) => {
      set({
        threads: get().threads.map((thread) => {
          if (thread.threadId === id) return { ...thread, title };
          return thread;
        }),
      });
      threadsService.renameThread(id, title);
      callbacksManager.emit("onThreadRenamed", {
        threadId: id,
        title,
        isAutoGenerated: false,
      });
    },

    onDeleteThread: (id) => {
      const thisStore = get();
      if (thisStore.threadId === id) {
        thisStore.onSwitchToNewThread();
      }
      set({
        threads: thisStore.threads.filter((t) => t.threadId !== id),
      });
      threadsService.deleteThread(id);
      callbacksManager.emit("onThreadDeleted", { threadId: id });
    },

    onClearThreadHistory: async (id) => {
      await threadsService.clearHistory(id);
      if (get().threadId === id) {
        useMessageStore.getState().clearMessages();
      }
      callbacksManager.emit("onThreadCleared", { threadId: id });
    },
  }));
}
