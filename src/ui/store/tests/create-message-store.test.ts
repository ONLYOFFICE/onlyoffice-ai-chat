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

function makeHistory(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...makeMsg("user", `m${i}`),
    id: `m${i}`,
    createdAt: new Date(1000 + i),
  }));
}

type Paged = ReturnType<typeof makeHistory>;

/**
 * Backend double over a fixed history: keyset pages in both directions,
 * or — with `ignoreDirection` — an adapter that only ever reads forward,
 * which is what a host that has not implemented the parameter looks like.
 */
function makePagedApi(
  history: Paged,
  opts: { ignoreDirection?: boolean } = {}
) {
  const readMessages = vi.fn(
    async (
      _threadId: string,
      count?: number,
      cursor?: { id: string },
      direction?: "asc" | "desc"
    ) => {
      if (direction === "desc" && !opts.ignoreDirection) {
        const end = cursor
          ? history.findIndex((m) => m.id === cursor.id)
          : history.length;
        const start = Math.max(0, end - (count ?? history.length));
        return history.slice(start, end).reverse();
      }
      const from = cursor
        ? history.findIndex((m) => m.id === cursor.id) + 1
        : 0;
      return history.slice(from, count ? from + count : undefined);
    }
  );
  return { api: makeApi(readMessages as never), readMessages };
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

  describe("reconcileMessage", () => {
    const withId = (m: ThreadMessageLike, id: string): ThreadMessageLike => ({
      ...m,
      id,
    });

    it("replaces the matching message in place, preserving position", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(withId(makeMsg("user", "one"), "a"));
      store.getState().addMessage(withId(makeMsg("assistant", "two"), "b"));
      store
        .getState()
        .reconcileMessage("a", withId(makeMsg("user", "one-reconciled"), "a"));
      const messages = store.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages.map((m) => m.id)).toEqual(["a", "b"]);
      expect(
        (messages[0].content as unknown as { text: string }[])[0].text
      ).toBe("one-reconciled");
    });

    it("no-ops when no message matches the id", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().addMessage(withId(makeMsg("user", "one"), "a"));
      const before = store.getState().messages;
      store
        .getState()
        .reconcileMessage("missing", withId(makeMsg("user", "x"), "missing"));
      // Same array reference back — nothing changed, no needless re-render.
      expect(store.getState().messages).toBe(before);
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

    it("reports a failed read on onError and keeps the current messages", async () => {
      const failure = new Error("offline");
      const loaded = [makeMsg("user", "already here")];
      api = makeApi(vi.fn().mockResolvedValue(loaded));
      const store = createMessageStore({ ctx, api });
      await store.getState().fetchPrevMessages("thread-1");

      api.threads.readMessages = vi.fn().mockRejectedValue(failure);
      await expect(
        store.getState().fetchPrevMessages("thread-2")
      ).resolves.toBeUndefined();

      expect(ctx.callbacksManager.emit).toHaveBeenCalledWith("onError", {
        type: "storage",
        error: failure,
        context: "messages:load",
      });
      // Not wiped — an empty list would read as a lost history.
      expect(store.getState().messages).toEqual(loaded);
    });

    it("opens the thread on its newest page when pagination is on", async () => {
      const history = makeHistory(150);
      const { api: paged, readMessages } = makePagedApi(history);
      const store = createMessageStore({
        ctx,
        api: paged,
        getPagination: () => true,
      });

      await store.getState().fetchPrevMessages("thread-1");

      expect(readMessages).toHaveBeenCalledTimes(1);
      expect(readMessages).toHaveBeenCalledWith(
        "thread-1",
        100,
        undefined,
        "desc"
      );
      const { messages, hasMoreOlderMessages } = store.getState();
      // The tail, in reading order — newest last.
      expect(messages).toHaveLength(100);
      expect(messages[0]?.id).toBe("m50");
      expect(messages[99]?.id).toBe("m149");
      expect(hasMoreOlderMessages).toBe(true);
    });

    it("drains forward when the backend ignores the direction", async () => {
      const history = makeHistory(150);
      const { api: paged, readMessages } = makePagedApi(history, {
        ignoreDirection: true,
      });
      const store = createMessageStore({
        ctx,
        api: paged,
        getPagination: () => true,
      });

      await store.getState().fetchPrevMessages("thread-1");

      // The descending probe came back ascending, so the whole thread is
      // read forward rather than shown beginning-first.
      expect(readMessages).toHaveBeenNthCalledWith(
        1,
        "thread-1",
        100,
        undefined,
        "desc"
      );
      const { messages, hasMoreOlderMessages } = store.getState();
      expect(messages).toHaveLength(150);
      expect(messages[0]?.id).toBe("m0");
      expect(hasMoreOlderMessages).toBe(false);
    });

    it("keeps a short ascending page as the whole thread", async () => {
      const history = makeHistory(40);
      const { api: paged, readMessages } = makePagedApi(history, {
        ignoreDirection: true,
      });
      const store = createMessageStore({
        ctx,
        api: paged,
        getPagination: () => true,
      });

      await store.getState().fetchPrevMessages("thread-1");

      // Nothing to drain — one request, order untouched.
      expect(readMessages).toHaveBeenCalledTimes(1);
      expect(store.getState().messages.map((m) => m.id)).toEqual(
        history.map((m) => m.id)
      );
      expect(store.getState().hasMoreOlderMessages).toBe(false);
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

  describe("loadOlderMessages", () => {
    async function openTail(historySize = 150) {
      const history = makeHistory(historySize);
      const { api: paged, readMessages } = makePagedApi(history);
      const store = createMessageStore({
        ctx,
        api: paged,
        getPagination: () => true,
      });
      await store.getState().fetchPrevMessages("thread-1");
      readMessages.mockClear();
      return { store, readMessages, history };
    }

    it("prepends the previous page in reading order", async () => {
      const { store, readMessages } = await openTail(250);

      await store.getState().loadOlderMessages();

      expect(readMessages).toHaveBeenCalledWith(
        "thread-1",
        100,
        expect.objectContaining({ id: "m150" }),
        "desc"
      );
      const { messages, hasMoreOlderMessages } = store.getState();
      expect(messages).toHaveLength(200);
      expect(messages[0]?.id).toBe("m50");
      expect(messages[199]?.id).toBe("m249");
      expect(hasMoreOlderMessages).toBe(true);
    });

    it("stops at the beginning of the thread", async () => {
      const { store } = await openTail(150);

      await store.getState().loadOlderMessages();

      expect(store.getState().messages).toHaveLength(150);
      expect(store.getState().messages[0]?.id).toBe("m0");
      expect(store.getState().hasMoreOlderMessages).toBe(false);
    });

    it("coalesces concurrent callers onto one request", async () => {
      const { store, readMessages } = await openTail(250);

      await Promise.all([
        store.getState().loadOlderMessages(),
        store.getState().loadOlderMessages(),
      ]);

      expect(readMessages).toHaveBeenCalledTimes(1);
      expect(store.getState().messages).toHaveLength(200);
    });

    it("stops when a cursor-ignoring backend repeats the same page", async () => {
      const history = makeHistory(250);
      const tail = history.slice(150).reverse();
      const readMessages = vi.fn().mockResolvedValue(tail);
      const store = createMessageStore({
        ctx,
        api: makeApi(readMessages as never),
        getPagination: () => true,
      });
      await store.getState().fetchPrevMessages("thread-1");

      await store.getState().loadOlderMessages();

      expect(store.getState().messages).toHaveLength(100);
      expect(store.getState().hasMoreOlderMessages).toBe(false);
    });

    it("drops a page that lands after the thread changed", async () => {
      const history = makeHistory(250);
      const { api: paged } = makePagedApi(history);
      const store = createMessageStore({
        ctx,
        api: paged,
        getPagination: () => true,
      });
      await store.getState().fetchPrevMessages("thread-1");

      const pending = store.getState().loadOlderMessages();
      store.getState().claimThreadId("thread-2");
      await pending;

      expect(store.getState()._currentThreadId).toBe("thread-2");
      expect(store.getState().messages).toHaveLength(100);
    });

    it("keeps the window loadable after a failed page", async () => {
      const { store, readMessages } = await openTail(250);
      const failure = new Error("nope");
      readMessages.mockRejectedValueOnce(failure);

      await store.getState().loadOlderMessages();

      expect(ctx.callbacksManager.emit).toHaveBeenCalledWith("onError", {
        error: failure,
        context: "messages:load-older",
        type: "storage",
      });
      expect(store.getState().hasMoreOlderMessages).toBe(true);
      expect(store.getState().isLoadingOlderMessages).toBe(false);
    });

    it("does nothing without pagination", async () => {
      const store = createMessageStore({ ctx, api });
      await store.getState().loadOlderMessages();
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

  describe("orphanStreams", () => {
    it("bumps the epoch and resets the busy flags", () => {
      const store = createMessageStore({ ctx, api });
      store.getState().setIsStreamRunning(true);
      store.getState().setIsRequestRunning(true);
      store.getState().setIsToolPending(true);
      const epoch = store.getState()._streamEpoch;

      store.getState().orphanStreams();

      expect(store.getState()._streamEpoch).toBe(epoch + 1);
      expect(store.getState().isStreamRunning).toBe(false);
      expect(store.getState().isRequestRunning).toBe(false);
      expect(store.getState().isToolPending).toBe(false);
    });

    it("does not abort the in-flight round — it keeps draining", () => {
      const store = createMessageStore({ ctx, api });
      const abort = new AbortController();
      store.getState().setAbortController(abort);

      store.getState().orphanStreams();

      expect(abort.signal.aborted).toBe(false);
    });

    it("fetchPrevMessages detaches any round streaming into the store", async () => {
      const store = createMessageStore({ ctx, api });
      store.getState().setIsStreamRunning(true);
      const epoch = store.getState()._streamEpoch;

      await store.getState().fetchPrevMessages("thread-1");

      expect(store.getState()._streamEpoch).toBe(epoch + 1);
      expect(store.getState().isStreamRunning).toBe(false);
    });
  });
});
