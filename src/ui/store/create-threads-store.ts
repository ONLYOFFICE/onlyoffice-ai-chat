import { create, type StoreApi, type UseBoundStore } from "zustand";
import i18n from "i18next";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { CallbacksManager } from "../providers/EventsProvider";
import type { PlatformAdapter } from "../providers/PlatformProvider/types";
import type { ServerAPI } from "../providers/ApiProvider";
import type { Thread } from "../../types";
import {
  PAGE_SIZE,
  drainPages,
  messagesCursorOf,
  threadsCursorOf,
} from "../../core/storage";
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
  /**
   * Load threads from persistent storage scoped to `entityId`. Pass
   * `undefined` (the unscoped/passthrough mode) to load only threads
   * not bound to any entity. With pagination enabled only the first
   * {@link PAGE_SIZE} threads are loaded — see {@link loadMoreThreads}.
   */
  initThreads: (entityId?: string) => Promise<void>;
  /**
   * True when the last loaded page was full, i.e. storage may hold more
   * threads than are currently in {@link threads}. Always `false` with
   * pagination disabled (the full list is loaded up front).
   */
  hasMoreThreads: boolean;
  /** True while {@link loadMoreThreads} is on the wire. */
  isLoadingMoreThreads: boolean;
  /**
   * Fetch the next page of threads (cursor derived from the last loaded
   * thread) and append it, de-duplicated by `threadId`. No-op when
   * pagination is disabled, everything is loaded, or a page is already
   * in flight.
   */
  loadMoreThreads: () => Promise<void>;
  /**
   * Drain every remaining page into the store — the fallback for
   * backends that don't implement server-side search, so the sidebar's
   * client-side filter covers the whole collection. Concurrent callers
   * share one drain.
   */
  ensureAllThreads: () => Promise<void>;
  /**
   * Server-side title search results (pagination mode), or `null` when
   * no server search is active — the sidebar then falls back to
   * client-side filtering over the loaded list.
   */
  searchResults: Thread[] | null;
  /** True when the last search page was full — more matches may exist. */
  hasMoreSearchResults: boolean;
  /** True while a search request (first page or next page) is on the wire. */
  isSearchLoading: boolean;
  /**
   * Run a server-side title search: sends `query` to storage
   * (`threads.readAll(entityId, count, cursor, query)`) and pages
   * through the matches. An empty `query` resets the search state.
   * Backends that ignore `query` are detected by a non-matching title
   * in the response — the store then falls back to draining all pages
   * for the client-side filter and stops asking. No-op (client-side
   * filtering keeps working over the full list) when pagination is off.
   */
  searchThreads: (query: string) => Promise<void>;
  /** Fetch the next page of search matches (cursor + same query). */
  loadMoreSearchResults: () => Promise<void>;
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
  /**
   * Create a fresh empty thread placeholder and switch to it. By default
   * the session chat profile is reset (the new chat starts on the
   * assignment-resolved profile); pass `keepSessionProfile` to preserve an
   * explicit session selection across the switch (e.g. host-driven scope
   * changes right after a picker selection).
   */
  onSwitchToNewThread: (opts?: { keepSessionProfile?: boolean }) => void;
  /** Switch to an existing thread by ID. */
  onSwitchToThread: (id: string) => void;
  /** Download the thread conversation as a `.docx` file via the platform file adapter. */
  onDownloadThread: (id: string, title?: string) => Promise<void>;
  /**
   * Export the thread conversation in a host-declared format. Resolves the
   * file extension from `platform.file.getExportFormats()` by `formatId` and
   * passes the format id through to `saveAsFile`.
   */
  onExportThread: (
    id: string,
    formatId: string,
    title?: string
  ) => Promise<void>;
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
  /** Lazy global pagination switch — mirrors `WidgetConfig.enablePagination`. */
  getPagination?: () => boolean;
}): UseBoundStore<StoreApi<ThreadsStoreState>> {
  const {
    api,
    platform,
    useProfilesStore,
    useMessageStore,
    callbacksManager,
    getPagination,
  } = deps;
  const paginated = () => getPagination?.() ?? false;

  const applyThreadContextFromThread = (thread?: Thread) => {
    const { getProfileById, setSessionChatProfile } =
      useProfilesStore.getState();
    const profile = thread?.profileId ? getProfileById(thread.profileId) : null;
    setSessionChatProfile(profile);
  };

  /**
   * Read a thread's full message list for download/export. With
   * pagination on, walks the thread in cursor pages; otherwise one
   * unbounded read — the pre-pagination behavior.
   */
  const readAllMessages = (threadId: string): Promise<ThreadMessageLike[]> =>
    paginated()
      ? drainPages(
          (count, cursor) => api.threads.readMessages(threadId, count, cursor),
          messagesCursorOf,
          (m) => m.id ?? ""
        )
      : api.threads.readMessages(threadId);

  // Scope of the currently loaded list — `loadMoreThreads` must page
  // within the same entity `initThreads` was called with.
  let loadedEntityId: string | undefined;
  // Coalesces concurrent `loadMoreThreads` callers onto ONE in-flight
  // page fetch. Returning the shared promise (instead of bailing out
  // early) is load-bearing: `ensureAllThreads` loops `while (hasMore)
  // await loadMoreThreads()`, and an early-return would spin that loop
  // through resolved promises — an endless microtask chain that starves
  // the macrotask queue, so the in-flight response could never land.
  let loadMoreInFlight: Promise<void> | null = null;
  // Coalesces concurrent `ensureAllThreads` callers into one drain.
  let ensureAllInFlight: Promise<void> | null = null;
  // The query behind the current `searchResults` — `loadMoreSearchResults`
  // pages with it. Closure-held: display-side input state lives in the UI.
  let activeSearchQuery = "";
  // Monotonic sequence guarding against out-of-order search responses
  // (fast typing): only the latest request may write results.
  let searchSeq = 0;
  // Flips to false once the backend demonstrably ignored `query`
  // (returned a non-matching title) — from then on every search goes
  // straight to the drain fallback instead of re-probing per keystroke.
  let searchSupported = true;
  // Coalesces concurrent `loadMoreSearchResults` callers (same rationale
  // as `loadMoreInFlight`).
  let searchLoadMoreInFlight: Promise<void> | null = null;

  const matchesQuery = (thread: Thread, query: string): boolean =>
    (thread.title ?? "").toLowerCase().includes(query.toLowerCase());

  return create<ThreadsStoreState>((set, get) => ({
    threadId: "",
    threads: [],
    hasMoreThreads: false,
    isLoadingMoreThreads: false,
    searchResults: null,
    hasMoreSearchResults: false,
    isSearchLoading: false,

    initThreads: async (entityId) => {
      loadedEntityId = entityId;
      if (!paginated()) {
        const threads = await api.threads.list(entityId);
        set({ threads, hasMoreThreads: false });
        return;
      }
      const page = await api.threads.list(entityId, PAGE_SIZE);
      set({
        threads: page,
        // A full page means storage may hold more; a longer page means a
        // legacy backend ignored `count` and returned everything.
        hasMoreThreads: page.length === PAGE_SIZE,
      });
    },

    loadMoreThreads: () => {
      if (loadMoreInFlight) return loadMoreInFlight;
      const { threads, hasMoreThreads } = get();
      if (!paginated() || !hasMoreThreads) return Promise.resolve();
      const last = threads[threads.length - 1];
      if (!last) return Promise.resolve();
      loadMoreInFlight = (async () => {
        set({ isLoadingMoreThreads: true });
        try {
          const page = await api.threads.list(
            loadedEntityId,
            PAGE_SIZE,
            threadsCursorOf(last)
          );
          const known = new Set(get().threads.map((t) => t.threadId));
          const fresh = page.filter((t) => !known.has(t.threadId));
          set((state) => ({
            threads: [...state.threads, ...fresh],
            // Stop when the page came short OR contributed nothing new (a
            // backend that ignores the cursor must not loop forever).
            hasMoreThreads: page.length === PAGE_SIZE && fresh.length > 0,
          }));
        } finally {
          set({ isLoadingMoreThreads: false });
          loadMoreInFlight = null;
        }
      })();
      return loadMoreInFlight;
    },

    ensureAllThreads: async () => {
      if (!paginated() || !get().hasMoreThreads) return;
      if (ensureAllInFlight) return ensureAllInFlight;
      ensureAllInFlight = (async () => {
        try {
          while (get().hasMoreThreads) {
            await get().loadMoreThreads();
          }
        } finally {
          ensureAllInFlight = null;
        }
      })();
      return ensureAllInFlight;
    },

    searchThreads: async (query) => {
      activeSearchQuery = query;
      const seq = ++searchSeq;
      if (!paginated() || !query) {
        set({
          searchResults: null,
          hasMoreSearchResults: false,
          isSearchLoading: false,
        });
        return;
      }
      // The backend already proved it ignores `query` — go straight to
      // the full-drain fallback; the sidebar filters client-side.
      if (!searchSupported) {
        set({ isSearchLoading: true });
        try {
          await get().ensureAllThreads();
        } finally {
          if (seq === searchSeq) set({ isSearchLoading: false });
        }
        return;
      }
      set({ isSearchLoading: true });
      try {
        const page = await api.threads.list(
          loadedEntityId,
          PAGE_SIZE,
          undefined,
          query
        );
        if (seq !== searchSeq) return; // a newer query superseded this one
        if (page.some((t) => !matchesQuery(t, query))) {
          // Contract violation ⇒ the backend ignored `query`. Fall back
          // to the drain + client-side filter, permanently for this
          // session.
          searchSupported = false;
          set({ searchResults: null, hasMoreSearchResults: false });
          await get().ensureAllThreads();
          return;
        }
        set({
          searchResults: page,
          hasMoreSearchResults: page.length === PAGE_SIZE,
        });
      } finally {
        if (seq === searchSeq) set({ isSearchLoading: false });
      }
    },

    loadMoreSearchResults: () => {
      if (searchLoadMoreInFlight) return searchLoadMoreInFlight;
      const { searchResults, hasMoreSearchResults } = get();
      if (!paginated() || !searchResults || !hasMoreSearchResults) {
        return Promise.resolve();
      }
      const last = searchResults[searchResults.length - 1];
      if (!last) return Promise.resolve();
      const seq = searchSeq;
      const query = activeSearchQuery;
      searchLoadMoreInFlight = (async () => {
        set({ isSearchLoading: true });
        try {
          const page = await api.threads.list(
            loadedEntityId,
            PAGE_SIZE,
            threadsCursorOf(last),
            query
          );
          if (seq !== searchSeq) return; // the query changed mid-flight
          const known = new Set(get().searchResults?.map((t) => t.threadId));
          const fresh = page.filter((t) => !known.has(t.threadId));
          set((state) => ({
            searchResults: [...(state.searchResults ?? []), ...fresh],
            hasMoreSearchResults: page.length === PAGE_SIZE && fresh.length > 0,
          }));
        } finally {
          if (seq === searchSeq) set({ isSearchLoading: false });
          searchLoadMoreInFlight = null;
        }
      })();
      return searchLoadMoreInFlight;
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

    onSwitchToNewThread: (opts) => {
      const previousThreadId = get().threadId;
      if (!opts?.keepSessionProfile) applyThreadContextFromThread(undefined);
      set({ threadId: "" });
      // Reset the message list synchronously: in headless setups
      // (custom router that mounts/unmounts ChatPage on page change)
      // there is no `useMessages` instance subscribed between switches,
      // so the reactive effect cannot be relied on.
      const messageStore = useMessageStore.getState();
      // A round still streaming into the previous thread (e.g. an image
      // generation running when the host re-scopes to another entity)
      // must not keep writing into the now-empty list — detach it first.
      messageStore.orphanStreams();
      messageStore.claimThreadId("");
      messageStore.clearMessages();
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
      // With a partially loaded list (pagination) the target thread may
      // not be in memory yet — recover its profile binding from storage
      // so the session model still switches to the thread's own model.
      if (!thread && paginated()) {
        void api.threads
          .getById(id)
          .then((stored) => {
            if (stored && get().threadId === id) {
              applyThreadContextFromThread(stored);
            }
          })
          .catch(() => undefined);
      }
      set({ threadId: id });
      // Load the thread's messages directly. The `useMessages` effect
      // also reacts to `threadId` changes, but it only runs when the
      // chat page is mounted — custom routers may unmount and remount
      // ChatPage on every page switch, which makes purely-reactive
      // loading miss the transition. Calling `fetchPrevMessages` here
      // synchronously sets `_currentThreadId`, so the effect — if it
      // runs after the remount — short-circuits via the claim check
      // and we don't double-fetch.
      void useMessageStore.getState().fetchPrevMessages(id);
      callbacksManager.emit("onThreadsUpdated", {
        kind: "switched",
        threadId: id,
        previousThreadId,
      });
    },

    onDownloadThread: async (id, title) => {
      const messages = await readAllMessages(id);
      const fileName = removeSpecialCharacter(title || i18n.t("ChatExport"));
      const content = convertMessagesToMd(messages);
      platform.file?.saveAsFile?.(content, `${fileName}.docx`);
    },

    onExportThread: async (id, formatId, title) => {
      const formats = platform.file?.getExportFormats?.() ?? [];
      const extension =
        formats.find((f) => f.id === formatId)?.extension || "docx";
      const messages = await readAllMessages(id);
      const fileName = removeSpecialCharacter(title || i18n.t("ChatExport"));
      const content = convertMessagesToMd(messages);
      platform.file?.saveAsFile?.(
        content,
        `${fileName}.${extension}`,
        formatId
      );
    },

    onRenameThread: async (id, title) => {
      const rename = (thread: Thread) =>
        thread.threadId === id ? { ...thread, title } : thread;
      set((state) => ({
        threads: state.threads.map(rename),
        // Keep an active server-search view in step with the rename.
        searchResults: state.searchResults?.map(rename) ?? null,
      }));
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
      set((state) => ({
        threads: state.threads.filter((t) => t.threadId !== id),
        // A deleted thread must also leave an active server-search view.
        searchResults:
          state.searchResults?.filter((t) => t.threadId !== id) ?? null,
      }));
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
