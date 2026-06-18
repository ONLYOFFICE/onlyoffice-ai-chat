import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppContext } from "../../../app-context";
import { createMessageStore } from "../create-message-store";
import type { ServerAPI } from "../../providers/ApiProvider";
import type { ThreadMessageLike } from "@assistant-ui/react";

function makeCtx(): AppContext {
  return {
    callbacksManager: {
      emit: vi.fn(),
      setCallbacks: vi.fn(),
      getCallbacks: vi.fn().mockReturnValue({}),
    },
  } as unknown as AppContext;
}

function makeApi(readMessages = vi.fn().mockResolvedValue([])): ServerAPI {
  return {
    threads: { readMessages },
  } as unknown as ServerAPI;
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
  let api: ServerAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = makeCtx();
    api = makeApi();
  });

  it("starts with empty state", () => {
    const store = createMessageStore({ ctx, api });
    const state = store.getState();
    expect(state.messages).toEqual([]);
    expect(state.isStreamRunning).toBe(false);
    expect(state.isRequestRunning).toBe(false);
  });

  describe("setIsStreamRunning / setIsRequestRunning", () => {
    it("toggles stream running", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().setIsStreamRunning(true);
      expect(store.getState().isStreamRunning).toBe(true);
      store.getState().setIsStreamRunning(false);
      expect(store.getState().isStreamRunning).toBe(false);
    });

    it("toggles request running", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().setIsRequestRunning(true);
      expect(store.getState().isRequestRunning).toBe(true);
    });
  });

  describe("addMessage", () => {
    it("appends message to list", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(makeMsg("user", "hello"));
      expect(store.getState().messages).toHaveLength(1);
    });

    it("always appends, never replacing an incomplete last message", () => {
      const store = createMessageStore({ ctx, api });
      store
        .getState()
        .addMessage(makeMsg("assistant", "errored", { type: "incomplete" }));
      // Both a same-role retry and a new-role turn must append — the
      // errored message is never touched.
      store.getState().addMessage(makeMsg("assistant", "retry"));
      store.getState().addMessage(makeMsg("user", "next"));
      expect(store.getState().messages).toHaveLength(3);
      expect(store.getState().messages.map((m) => m.role)).toEqual([
        "assistant",
        "assistant",
        "user",
      ]);
    });
  });

  describe("updateLastMessage", () => {
    it("replaces the last message", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(makeMsg("user", "a"));
      store.getState().addMessage(makeMsg("assistant", "b"));
      store.getState().updateLastMessage(makeMsg("assistant", "b-updated"));
      expect(store.getState().messages).toHaveLength(2);
      expect(
        (
          store.getState().messages[1].content as unknown as { text: string }[]
        )[0].text
      ).toBe("b-updated");
    });
  });

  describe("truncateMessagesAfter", () => {
    it("keeps messages[0..index] and drops the rest", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(makeMsg("user", "a"));
      store.getState().addMessage(makeMsg("assistant", "b"));
      store.getState().addMessage(makeMsg("user", "c"));
      store.getState().addMessage(makeMsg("assistant", "d"));

      store.getState().truncateMessagesAfter(0);

      expect(store.getState().messages).toHaveLength(1);
      expect(
        (
          store.getState().messages[0].content as unknown as { text: string }[]
        )[0].text
      ).toBe("a");
    });

    it("preserves all messages when index is the last one", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(makeMsg("user", "a"));
      store.getState().addMessage(makeMsg("assistant", "b"));

      store.getState().truncateMessagesAfter(1);

      expect(store.getState().messages).toHaveLength(2);
    });

    it("ignores negative indices and out-of-range values", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(makeMsg("user", "a"));
      store.getState().addMessage(makeMsg("assistant", "b"));

      store.getState().truncateMessagesAfter(-1);
      expect(store.getState().messages).toHaveLength(2);

      store.getState().truncateMessagesAfter(5);
      expect(store.getState().messages).toHaveLength(2);
    });
  });

  describe("fetchPrevMessages", () => {
    it("fetches messages and sets them", async () => {
      const msgs = [makeMsg("user", "prev")];
      const readMessages = vi.fn().mockResolvedValue(msgs);
      api = makeApi(readMessages);
      const store = createMessageStore({ ctx, api });

      await store.getState().fetchPrevMessages("thread-1");

      expect(readMessages).toHaveBeenCalledWith("thread-1");
      expect(store.getState().messages).toEqual(msgs);
    });

    it("discards stale results if thread changed", async () => {
      const slowMsgs = [makeMsg("user", "old")];
      const readMessages = vi.fn().mockImplementation((threadId: string) => {
        if (threadId === "thread-1") {
          return new Promise((resolve) =>
            setTimeout(() => resolve(slowMsgs), 50)
          );
        }
        return Promise.resolve([]);
      });
      api = makeApi(readMessages);
      const store = createMessageStore({ ctx, api });

      const p = store.getState().fetchPrevMessages("thread-1");
      await store.getState().fetchPrevMessages("thread-2");
      await p;
      expect(store.getState()._currentThreadId).toBe("thread-2");
      expect(store.getState().messages).toEqual([]);
    });
  });

  describe("stopMessage", () => {
    it("aborts stream and emits onStreamStop", () => {
      const store = createMessageStore({ ctx, api });
      const abort = new AbortController();
      const abortSpy = vi.spyOn(abort, "abort");
      store.getState().setAbortController(abort);
      store.getState().setIsStreamRunning(true);
      store.getState().stopMessage();
      expect(abortSpy).toHaveBeenCalled();
      expect(store.getState().isStreamRunning).toBe(false);
      expect(ctx.callbacksManager.emit).toHaveBeenCalledWith(
        "onStreamStop",
        expect.any(Object)
      );
    });
  });

  describe("clearMessages", () => {
    it("clears messages", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(makeMsg("user", "hello"));
      store.getState().clearMessages();
      expect(store.getState().messages).toEqual([]);
    });
  });
});
