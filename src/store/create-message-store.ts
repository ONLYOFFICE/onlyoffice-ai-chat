import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";

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
  /** Set the streaming flag. */
  setIsStreamRunning: (value: boolean) => void;
  /** Set the request-in-flight flag. */
  setIsRequestRunning: (value: boolean) => void;
  /** Append a message. If the last message has status "incomplete", it is replaced instead. */
  addMessage: (message: ThreadMessageLike) => void;
  /** Replace the last message in the list (used during streaming updates). */
  updateLastMessage: (message: ThreadMessageLike) => void;
  /** Load persisted messages for the given thread from storage. */
  fetchPrevMessages: (threadId: string) => Promise<void>;
  /** Abort the current stream and notify listeners via the callbacks manager. */
  stopMessage: () => void;
  /** Remove all messages from the store and clear the provider's message history. */
  clearMessages: () => void;
}

export function createMessageStore(
  ctx: AppContext
): UseBoundStore<StoreApi<MessageStoreState>> {
  return create<MessageStoreState>((set, get) => ({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,
    _currentThreadId: "",

    fetchPrevMessages: async (threadId: string) => {
      set({ _currentThreadId: threadId });
      const storage = ctx.storage;
      const fetchedMessages = await storage.messages.getByThread(threadId);
      // Guard: if thread changed while awaiting, discard stale results
      const current = get();
      if (current._currentThreadId !== threadId) return;
      set({ messages: fetchedMessages });
      ctx.provider.setCurrentProviderPrevMessages(fetchedMessages);
    },

    setIsStreamRunning: (value) => set({ isStreamRunning: value }),
    setIsRequestRunning: (value) => set({ isRequestRunning: value }),

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

    stopMessage: () => {
      get().setIsStreamRunning(false);
      ctx.provider.stopMessage();
      ctx.callbacksManager.emit("onStreamStop", {
        threadId: get()._currentThreadId,
        messageUID: "",
      });
    },

    clearMessages: () => {
      set({ messages: [] });
      ctx.provider.setCurrentProviderPrevMessages([]);
    },
  }));
}
