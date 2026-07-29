import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import { drainPages, messagesCursorOf } from "../../core/storage";
import type { ServerAPI } from "../providers/ApiProvider";

/**
 * Zustand state for the message list of the currently active thread.
 *
 * Manages the in-memory message array, streaming/request flags, and
 * operations for appending, updating, fetching, and clearing messages.
 */
export interface MessageStoreState {
  /** Ordered list of messages in the active thread. */
  messages: ThreadMessageLike[];
  /** `true` while the provider is actively streaming a response. */
  isStreamRunning: boolean;
  /** `true` while a request (stream or non-stream) is in flight. */
  isRequestRunning: boolean;
  /**
   * `true` while at least one tool call is executing, plus a short grace
   * window after it completes. While set, the chat UI suppresses the
   * "Analyzing…" indicator so the tool's own spinner is the sole loading
   * affordance.
   */
  isToolPending: boolean;
  /**
   * Internal tracker for the thread whose messages are loaded; used to
   * discard stale fetches. Starts as `null` (a sentinel no real `threadId`
   * can equal — including the empty "new chat" id `""`) so the first sync
   * always fetches, while remounts with the same thread are no-ops.
   */
  _currentThreadId: string | null;
  /**
   * Context scope (agent workspace) of the loaded thread, derived from the
   * `metadata.custom.contextEntityId` stamp on its last user message once
   * `fetchPrevMessages` settles:
   * - `undefined` — unknown (nothing loaded yet, a fetch is in flight, or
   *   the list is the local echo of a just-created thread) — consumers
   *   must not act on it;
   * - `null` — the thread carries no context stamp (plain conversation);
   * - string — the context entity the conversation last ran against.
   */
  threadContextEntityId?: string | null;
  /** Abort controller for the in-flight streaming request, if any. */
  _abortController?: AbortController;
  /** Set the streaming flag. */
  setIsStreamRunning: (value: boolean) => void;
  /** Set the request-in-flight flag. */
  setIsRequestRunning: (value: boolean) => void;
  /** Set the tool-pending flag. */
  setIsToolPending: (value: boolean) => void;
  /** Replace the abort controller used by `stopMessage`. */
  setAbortController: (controller: AbortController | undefined) => void;
  /** Append a message to the end of the list. Never modifies existing messages. */
  addMessage: (message: ThreadMessageLike) => void;
  /** Replace the last message in the list (used during streaming updates). */
  updateLastMessage: (message: ThreadMessageLike) => void;
  /**
   * Drop every message after `index`, keeping `messages[0..index]`.
   * Used by the regenerate flow to discard the previous assistant reply
   * (and any trailing tool-call hops) before re-streaming.
   */
  truncateMessagesAfter: (index: number) => void;
  /** Load persisted messages for the given thread from the core threads engine. */
  fetchPrevMessages: (threadId: string) => Promise<void>;
  /**
   * Mark the in-memory `messages` array as already in sync with `threadId`,
   * without reloading from storage. Used by the streaming path: the engine
   * has just created a new thread and populated the local list as the
   * response streamed, so a follow-up fetch would only race with the local
   * state and risk reordering.
   */
  claimThreadId: (threadId: string) => void;
  /** Abort the current stream and notify listeners via the callbacks manager. */
  stopMessage: () => void;
  /** Remove all messages from the store. */
  clearMessages: () => void;
}

// The LAST user message decides the thread's context: a stamped message
// marks an agent round, a later unstamped one marks the return to a plain
// conversation — so absence on the newest user message means "no context".
function deriveThreadContext(messages: ThreadMessageLike[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const value = message.metadata?.custom?.["contextEntityId"];
    return typeof value === "string" ? value : null;
  }
  return null;
}

export function createMessageStore(deps: {
  ctx: AppContext;
  api: ServerAPI;
  /** Lazy global pagination switch — mirrors `WidgetConfig.enablePagination`. */
  getPagination?: () => boolean;
}): UseBoundStore<StoreApi<MessageStoreState>> {
  const { ctx, api, getPagination } = deps;

  /**
   * Read the thread's full history. With pagination on, walks the thread
   * in cursor pages of 100 (bounded requests, same complete result);
   * otherwise one unbounded read — the pre-pagination behavior.
   */
  const readAllMessages = (threadId: string): Promise<ThreadMessageLike[]> =>
    getPagination?.()
      ? drainPages(
          (count, cursor) => api.threads.readMessages(threadId, count, cursor),
          messagesCursorOf,
          (m) => m.id ?? ""
        )
      : api.threads.readMessages(threadId);

  return create<MessageStoreState>((set, get) => ({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,
    isToolPending: false,
    _currentThreadId: null,
    threadContextEntityId: undefined,
    _abortController: undefined,

    fetchPrevMessages: async (threadId: string) => {
      set({ _currentThreadId: threadId, threadContextEntityId: undefined });
      const fetchedMessages = await readAllMessages(threadId);
      const current = get();
      if (current._currentThreadId !== threadId) {
        return;
      }
      set({
        messages: fetchedMessages,
        threadContextEntityId: deriveThreadContext(fetchedMessages),
      });
    },

    claimThreadId: (threadId) => {
      // The local echo of a just-created thread: the host's own state is
      // the source of truth for its context, so keep it "unknown" here.
      set({ _currentThreadId: threadId, threadContextEntityId: undefined });
    },

    setIsStreamRunning: (value) => set({ isStreamRunning: value }),
    setIsRequestRunning: (value) => set({ isRequestRunning: value }),
    setIsToolPending: (value) => set({ isToolPending: value }),
    setAbortController: (controller) => set({ _abortController: controller }),

    addMessage: (message) => {
      // Always append — never touch existing messages. An errored
      // ("incomplete") turn stays in the thread untouched when the next
      // message arrives, so previous turns can't vanish.
      set((s) => ({ messages: [...s.messages, message] }));
    },

    updateLastMessage: (message) => {
      const { messages } = get();
      set({ messages: [...messages.slice(0, -1), message] });
    },

    truncateMessagesAfter: (index) => {
      const { messages } = get();
      if (index < 0 || index >= messages.length - 1) return;
      set({ messages: messages.slice(0, index + 1) });
    },

    stopMessage: () => {
      const { _abortController } = get();
      _abortController?.abort();
      set({
        isStreamRunning: false,
        isRequestRunning: false,
        isToolPending: false,
        _abortController: undefined,
      });
      ctx.callbacksManager.emit("onStreamStop", {
        threadId: get()._currentThreadId ?? "",
        messageUID: "",
      });
    },

    clearMessages: () => {
      set({ messages: [], threadContextEntityId: undefined });
    },
  }));
}
