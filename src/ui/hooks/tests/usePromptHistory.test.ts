// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const mockList = vi.fn();
const mockRecord = vi.fn();
const mockUseStores = vi.fn();

vi.mock("../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

import {
  __resetPromptHistoryCache,
  usePromptHistory,
} from "../usePromptHistory";

/**
 * Minimal stand-in for the threads store: enough of zustand's shape for
 * the hook — a selector call, and `subscribe` with (state, prev).
 */
function makeThreadsStore(threadId: string) {
  let state = { threadId };
  const listeners = new Set<(s: typeof state, p: typeof state) => void>();
  const store = (selector: (s: typeof state) => unknown) => selector(state);
  store.subscribe = (fn: (s: typeof state, p: typeof state) => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  /** Simulate the send claiming a freshly created thread id. */
  store.claim = (id: string) => {
    const prev = state;
    state = { threadId: id };
    for (const fn of [...listeners]) fn(state, prev);
  };
  return store;
}

/**
 * Stand-in for the message store. Only `messages.length` matters here:
 * the hook uses "the thread has messages" to tell a genuinely new chat
 * from one whose own first send is still in flight.
 */
function makeMessageStore(messageCount: number) {
  const state = { messages: Array.from({ length: messageCount }, () => ({})) };
  return { getState: () => state };
}

function setup(items: string[] = [], threadId = "", messageCount = 0) {
  mockList.mockResolvedValue(items);
  const useThreadsStore = makeThreadsStore(threadId);
  mockUseStores.mockReturnValue({
    useThreadsStore,
    useMessageStore: makeMessageStore(messageCount),
    api: {
      promptHistory: {
        list: mockList,
        record: mockRecord,
        clear: vi.fn(),
      },
    },
  });
  return useThreadsStore;
}

/** Render and wait for the initial async load to land. */
async function renderLoaded(items: string[] = [], threadId = "thread-1") {
  const store = setup(items, threadId);
  const view = renderHook(() => usePromptHistory());
  await waitFor(() => expect(mockList).toHaveBeenCalled());
  // Flush the promise continuation that fills the ref.
  await act(async () => {});
  return { ...view, store };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPromptHistoryCache();
});

describe("usePromptHistory", () => {
  it("loads history for the current thread", async () => {
    await renderLoaded(["a", "b"], "thread-1");
    expect(mockList).toHaveBeenCalledWith("thread-1");
  });

  it("walks backwards from the newest entry on previous()", async () => {
    const { result } = await renderLoaded(["oldest", "middle", "newest"]);
    expect(result.current.previous("")?.text).toBe("newest");
    expect(result.current.previous("")?.text).toBe("middle");
    expect(result.current.previous("")?.text).toBe("oldest");
  });

  it("stops at the oldest entry instead of wrapping", async () => {
    const { result } = await renderLoaded(["only"]);
    expect(result.current.previous("")?.text).toBe("only");
    // Nothing older — hand the arrow back to the textarea.
    expect(result.current.previous("")).toBeNull();
  });

  it("returns null when there is no history at all", async () => {
    const { result } = await renderLoaded([]);
    expect(result.current.previous("")).toBeNull();
  });

  it("returns null for next() when not browsing", async () => {
    const { result } = await renderLoaded(["a"]);
    expect(result.current.next()).toBeNull();
  });

  it("walks forward again with next()", async () => {
    const { result } = await renderLoaded(["one", "two"]);
    result.current.previous("");
    result.current.previous("");
    expect(result.current.next()?.text).toBe("two");
  });

  it("restores the in-progress draft when walking past the newest entry", async () => {
    const { result } = await renderLoaded(["sent"]);
    // The user had typed something, then pressed Up.
    expect(result.current.previous("my draft")?.text).toBe("sent");
    expect(result.current.next()?.text).toBe("my draft");
    // And is no longer browsing.
    expect(result.current.next()).toBeNull();
  });

  it("reports browsing state", async () => {
    const { result } = await renderLoaded(["a"]);
    expect(result.current.isBrowsing).toBe(false);
    await act(async () => {
      result.current.previous("");
    });
    expect(result.current.isBrowsing).toBe(true);
    await act(async () => {
      result.current.next();
    });
    expect(result.current.isBrowsing).toBe(false);
  });

  it("reset() abandons the walk", async () => {
    const { result } = await renderLoaded(["a", "b"]);
    result.current.previous("");
    await act(async () => {
      result.current.reset();
    });
    // Back to the newest end: the next Up starts over at "b".
    expect(result.current.previous("")?.text).toBe("b");
  });

  it("record() appends locally so the entry is walkable immediately", async () => {
    const { result } = await renderLoaded([], "thread-1");
    await act(async () => {
      result.current.record("fresh");
    });
    expect(mockRecord).toHaveBeenCalledWith("fresh", "thread-1");
    expect(result.current.previous("")?.text).toBe("fresh");
  });

  it("record() trims and ignores a blank prompt", async () => {
    const { result } = await renderLoaded([]);
    await act(async () => {
      result.current.record("   ");
    });
    expect(mockRecord).not.toHaveBeenCalled();
    expect(result.current.previous("")).toBeNull();
  });

  it("record() collapses an immediate repeat", async () => {
    const { result } = await renderLoaded(["same"]);
    await act(async () => {
      result.current.record("same");
    });
    expect(result.current.previous("")?.text).toBe("same");
    // Only one copy in the list.
    expect(result.current.previous("")).toBeNull();
  });

  it("record() rewinds the cursor to the newest end", async () => {
    const { result } = await renderLoaded(["old"]);
    result.current.previous("");
    await act(async () => {
      result.current.record("new");
    });
    expect(result.current.previous("")?.text).toBe("new");
  });

  it("reloads and drops the previous chat's history when the thread changes", async () => {
    setup(["from-thread-a"], "thread-a");
    const { result, rerender } = renderHook(() => usePromptHistory());
    await act(async () => {});
    expect(result.current.previous("")?.text).toBe("from-thread-a");

    mockList.mockResolvedValue(["from-thread-b"]);
    setup(["from-thread-b"], "thread-b");
    rerender();
    await act(async () => {});

    expect(mockList).toHaveBeenLastCalledWith("thread-b");
    expect(result.current.previous("")?.text).toBe("from-thread-b");
  });

  it("starts a new chat with an empty history instead of reading a shared bucket", async () => {
    setup(["from-another-chat"], "");
    const { result } = renderHook(() => usePromptHistory());
    await act(async () => {});

    // No thread yet — nothing to read, and nothing borrowed from elsewhere.
    expect(mockList).not.toHaveBeenCalled();
    expect(result.current.previous("")).toBeNull();
  });

  it("attributes a new chat's first prompt to the thread the send creates", async () => {
    const store = setup([], "");
    const { result } = renderHook(() => usePromptHistory());
    await act(async () => {});

    await act(async () => {
      result.current.record("first");
    });
    // The thread does not exist yet, so nothing is persisted...
    expect(mockRecord).not.toHaveBeenCalled();
    // ...but it is already walkable in the box.
    expect(result.current.previous("")?.text).toBe("first");

    await act(async () => {
      store.claim("thread-new");
    });
    expect(mockRecord).toHaveBeenCalledWith("first", "thread-new");
  });

  it("keeps a new chat's first prompt once the created thread re-renders", async () => {
    setup([], "");
    const { result, rerender } = renderHook(() => usePromptHistory());
    await act(async () => {});

    await act(async () => {
      result.current.record("first");
    });

    // The send creates the thread, so the hook re-renders scoped to it.
    // The backend has not necessarily stored the prompt yet — this read
    // races the write the claim above kicked off.
    setup([], "thread-new");
    rerender();
    await act(async () => {});

    // The first prompt must still be walkable: dropping it is exactly the
    // "my first message never appears in history" bug.
    expect(result.current.previous("")?.text).toBe("first");
  });

  it("keeps later prompts reachable past the first one", async () => {
    setup([], "");
    const { result, rerender } = renderHook(() => usePromptHistory());
    await act(async () => {});

    await act(async () => {
      result.current.record("first");
    });
    setup([], "thread-new");
    rerender();
    await act(async () => {});

    await act(async () => {
      result.current.record("second");
    });

    expect(result.current.previous("")?.text).toBe("second");
    expect(result.current.previous("")?.text).toBe("first");
  });

  it("keeps the first prompt across the empty → non-empty composer swap", async () => {
    // Sending the first message flips the thread from empty to non-empty,
    // and assistant-ui renders those as two different subtrees — so the
    // composer that recorded the prompt is unmounted and a fresh one takes
    // its place. Instance state alone would lose the prompt right here.
    const store = setup([], "");
    const first = renderHook(() => usePromptHistory());
    await act(async () => {});
    await act(async () => {
      first.result.current.record("my first prompt");
    });

    await act(async () => {
      store.claim("thread-new");
    });
    first.unmount();

    // The replacement composer mounts under the new thread id, and its
    // read can still beat the write that the claim kicked off. The user's
    // own message is already in the list — that is what made the thread
    // non-empty and triggered the swap.
    setup([], "thread-new", 1);
    const second = renderHook(() => usePromptHistory());
    await act(async () => {});

    expect(second.result.current.previous("")?.text).toBe("my first prompt");
  });

  it("keeps the first prompt when the composer remounts before the thread is named", async () => {
    // The real send order: the optimistic user message lands first, which
    // makes the thread non-empty and swaps composer subtrees — while
    // `threadId` is still "", because the backend names the thread later.
    // This is the sequence behind "my very first prompt never appears".
    const store = setup([], "");
    const first = renderHook(() => usePromptHistory());
    await act(async () => {});
    await act(async () => {
      first.result.current.record("my first prompt");
    });
    first.unmount();

    // Replacement composer: still unnamed, but the message list is no
    // longer empty.
    setup([], "", 1);
    const second = renderHook(() => usePromptHistory());
    await act(async () => {});

    // Recallable straight away, before the thread even has an id.
    expect(second.result.current.previous("")?.text).toBe("my first prompt");

    // And once the id arrives it is persisted against the right thread.
    await act(async () => {
      store.claim("thread-new");
    });
    expect(mockRecord).toHaveBeenCalledWith("my first prompt", "thread-new");
  });

  it("does not resurrect an abandoned new chat's prompt on a later fresh mount", async () => {
    // Sent in a new chat that never got named (failed / aborted send),
    // then the panel was closed.
    setup([], "");
    const first = renderHook(() => usePromptHistory());
    await act(async () => {});
    await act(async () => {
      first.result.current.record("abandoned prompt");
    });
    first.unmount();

    // Reopened later on a brand-new, empty chat.
    setup([], "");
    const second = renderHook(() => usePromptHistory());
    await act(async () => {});

    expect(second.result.current.previous("")).toBeNull();
  });

  it("does not carry one new chat's prompts into the next new chat", async () => {
    const store = setup([], "");
    const first = renderHook(() => usePromptHistory());
    await act(async () => {});
    await act(async () => {
      first.result.current.record("prompt in chat A");
    });
    await act(async () => {
      store.claim("thread-a");
    });
    first.unmount();

    // The user starts another brand-new chat: it must be empty, not seeded
    // with what was typed in the previous one.
    setup([], "");
    const second = renderHook(() => usePromptHistory());
    await act(async () => {});

    expect(second.result.current.previous("")).toBeNull();
  });
});
