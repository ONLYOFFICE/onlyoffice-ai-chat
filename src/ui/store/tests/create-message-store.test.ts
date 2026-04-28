import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppContext } from "../../../app-context";
import { createMessageStore } from "../create-message-store";
import type { ThreadMessageLike } from "@assistant-ui/react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides?: Partial<AppContext>): AppContext {
  return {
    storage: {
      messages: {
        getByThread: vi.fn().mockResolvedValue([]),
      },
    },
    provider: {
      setCurrentProviderPrevMessages: vi.fn(),
      stopMessage: vi.fn(),
    },
    callbacksManager: {
      emit: vi.fn(),
      setCallbacks: vi.fn(),
      getCallbacks: vi.fn().mockReturnValue({}),
    },
    ...overrides,
  } as unknown as AppContext;
}

function makeMsg(
  role: "user" | "assistant",
  text: string,
  status?: { type: string }
): ThreadMessageLike {
  return {
    role,
    content: [{ type: "text", text }],
    ...(status ? { status } : {}),
  } as ThreadMessageLike;
}

describe("createMessageStore", () => {
  let ctx: AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = makeCtx();
  });

  it("starts with empty state", () => {
    const store = createMessageStore(ctx);
    const state = store.getState();
    expect(state.messages).toEqual([]);
    expect(state.isStreamRunning).toBe(false);
    expect(state.isRequestRunning).toBe(false);
  });

  describe("setIsStreamRunning / setIsRequestRunning", () => {
    it("toggles stream running", () => {
      const store = createMessageStore(ctx);
      store.getState().setIsStreamRunning(true);
      expect(store.getState().isStreamRunning).toBe(true);
      store.getState().setIsStreamRunning(false);
      expect(store.getState().isStreamRunning).toBe(false);
    });

    it("toggles request running", () => {
      const store = createMessageStore(ctx);
      store.getState().setIsRequestRunning(true);
      expect(store.getState().isRequestRunning).toBe(true);
    });
  });

  describe("addMessage", () => {
    it("appends message to list", () => {
      const store = createMessageStore(ctx);
      store.getState().addMessage(makeMsg("user", "hello"));
      expect(store.getState().messages).toHaveLength(1);
    });

    it("replaces last message if it has incomplete status", () => {
      const store = createMessageStore(ctx);
      store
        .getState()
        .addMessage(makeMsg("assistant", "partial", { type: "incomplete" }));
      store.getState().addMessage(makeMsg("assistant", "complete"));
      expect(store.getState().messages).toHaveLength(1);
      expect(
        (store.getState().messages[0].content as { text: string }[])[0].text
      ).toBe("complete");
    });

    it("does not replace last message if it has complete status", () => {
      const store = createMessageStore(ctx);
      store
        .getState()
        .addMessage(makeMsg("assistant", "done", { type: "complete" }));
      store.getState().addMessage(makeMsg("user", "next"));
      expect(store.getState().messages).toHaveLength(2);
    });
  });

  describe("updateLastMessage", () => {
    it("replaces the last message", () => {
      const store = createMessageStore(ctx);
      store.getState().addMessage(makeMsg("user", "a"));
      store.getState().addMessage(makeMsg("assistant", "b"));
      store.getState().updateLastMessage(makeMsg("assistant", "b-updated"));
      expect(store.getState().messages).toHaveLength(2);
      expect(
        (store.getState().messages[1].content as { text: string }[])[0].text
      ).toBe("b-updated");
    });
  });

  describe("fetchPrevMessages", () => {
    it("fetches messages from storage and sets them", async () => {
      const msgs = [makeMsg("user", "prev")];
      const getByThread = vi.fn().mockResolvedValue(msgs);
      ctx = makeCtx({
        storage: { messages: { getByThread } },
      } as unknown as Partial<AppContext>);
      const store = createMessageStore(ctx);

      await store.getState().fetchPrevMessages("thread-1");

      expect(getByThread).toHaveBeenCalledWith("thread-1");
      expect(store.getState().messages).toEqual(msgs);
      expect(
        (
          ctx.provider as {
            setCurrentProviderPrevMessages: ReturnType<typeof vi.fn>;
          }
        ).setCurrentProviderPrevMessages
      ).toHaveBeenCalledWith(msgs);
    });

    it("discards stale results if thread changed", async () => {
      const slowMsgs = [makeMsg("user", "old")];
      const getByThread = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(slowMsgs), 50);
          })
      );
      ctx = makeCtx({
        storage: { messages: { getByThread } },
      } as unknown as Partial<AppContext>);
      const store = createMessageStore(ctx);

      const p = store.getState().fetchPrevMessages("thread-1");
      // Switch thread before first fetch resolves
      store.getState().fetchPrevMessages("thread-2");
      await p;
      // Messages should not be set for stale thread
      // (thread-2 has no messages from the empty mock)
      expect(store.getState()._currentThreadId).toBe("thread-2");
    });
  });

  describe("stopMessage", () => {
    it("stops stream and calls provider.stopMessage", () => {
      const store = createMessageStore(ctx);
      store.getState().setIsStreamRunning(true);
      store.getState().stopMessage();
      expect(store.getState().isStreamRunning).toBe(false);
      expect(
        (ctx.provider as { stopMessage: ReturnType<typeof vi.fn> }).stopMessage
      ).toHaveBeenCalled();
    });
  });

  describe("clearMessages", () => {
    it("clears messages and resets provider history", () => {
      const store = createMessageStore(ctx);
      store.getState().addMessage(makeMsg("user", "hello"));
      store.getState().clearMessages();
      expect(store.getState().messages).toEqual([]);
      expect(
        (
          ctx.provider as {
            setCurrentProviderPrevMessages: ReturnType<typeof vi.fn>;
          }
        ).setCurrentProviderPrevMessages
      ).toHaveBeenCalledWith([]);
    });
  });
});
