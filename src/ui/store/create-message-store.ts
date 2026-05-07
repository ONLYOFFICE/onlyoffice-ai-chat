import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
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
  /** Internal tracker for the thread whose messages are loaded; used to discard stale fetches. */
  _currentThreadId: string;
  /** Abort controller for the in-flight streaming request, if any. */
  _abortController?: AbortController;
  /** Set the streaming flag. */
  setIsStreamRunning: (value: boolean) => void;
  /** Set the request-in-flight flag. */
  setIsRequestRunning: (value: boolean) => void;
  /** Replace the abort controller used by `stopMessage`. */
  setAbortController: (controller: AbortController | undefined) => void;
  /** Append a message. If the last message has status "incomplete", it is replaced instead. */
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

export function createMessageStore(deps: {
  ctx: AppContext;
  api: ServerAPI;
}): UseBoundStore<StoreApi<MessageStoreState>> {
  const { ctx, api } = deps;

  return create<MessageStoreState>((set, get) => ({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,
    _currentThreadId: "",
    _abortController: undefined,

    fetchPrevMessages: async (threadId: string) => {
      set({ _currentThreadId: threadId });
      const fetchedMessages = await api.threads.readMessages(threadId);
      const current = get();
      if (current._currentThreadId !== threadId) return;
      set({ messages: fetchedMessages });
    },

    claimThreadId: (threadId) => set({ _currentThreadId: threadId }),

    setIsStreamRunning: (value) => set({ isStreamRunning: value }),
    setIsRequestRunning: (value) => set({ isRequestRunning: value }),
    setAbortController: (controller) => set({ _abortController: controller }),

    addMessage: (message) => {
      const { messages } = get();
      if (
        messages.length &&
        messages[messages.length - 1].status?.type === "incomplete"
      ) {
        set({ messages: [...messages.slice(0, -1), { ...message }] });
        return;
      }
      set({ messages: [...messages, message] });
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
        _abortController: undefined,
      });
      ctx.callbacksManager.emit("onStreamStop", {
        threadId: get()._currentThreadId,
        messageUID: "",
      });
    },

    clearMessages: () => {
      set({ messages: [] });
    },
  }));
}
