// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ThreadMessageLike } from "@assistant-ui/react";

type StoreState = {
  messages: ThreadMessageLike[];
  hasMoreOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
};

const state: StoreState = {
  messages: [],
  hasMoreOlderMessages: false,
  loadOlderMessages: () => Promise.resolve(),
};

const useMessageStore = Object.assign(
  (selector: (s: StoreState) => unknown) => selector(state),
  { getState: () => state }
);

vi.mock("../../store/context", () => ({
  useStores: () => ({ useMessageStore }),
}));

import { usePromptHistory } from "../usePromptHistory";

const user = (text: string): ThreadMessageLike => ({
  role: "user",
  content: [{ type: "text", text }],
});

const assistant = (text: string): ThreadMessageLike => ({
  role: "assistant",
  content: [{ type: "text", text }],
});

/** A thread of alternating prompts and replies, oldest first. */
const thread = (...prompts: string[]): ThreadMessageLike[] =>
  prompts.flatMap((p) => [user(p), assistant(`re: ${p}`)]);

beforeEach(() => {
  state.messages = [];
  state.hasMoreOlderMessages = false;
  state.loadOlderMessages = () => Promise.resolve();
});

describe("usePromptHistory", () => {
  it("walks back through the thread's own user messages", async () => {
    state.messages = thread("first", "second", "third");
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "third" });
    });
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "second" });
    });
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "first" });
    });
  });

  it("stops at the oldest prompt of a fully loaded thread", async () => {
    state.messages = thread("only");
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("");
    });
    await act(async () => {
      expect(await result.current.previous("")).toBeNull();
    });
  });

  it("reports nothing to walk in an empty thread", async () => {
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toBeNull();
    });
    expect(result.current.isBrowsing).toBe(false);
  });

  it("walks forward again and restores the draft past the newest entry", async () => {
    state.messages = thread("first", "second");
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("my draft");
    });
    await act(async () => {
      expect(await result.current.previous("my draft")).toEqual({
        text: "first",
      });
    });
    await act(async () => {
      expect(await result.current.next()).toEqual({ text: "second" });
    });
    await act(async () => {
      expect(await result.current.next()).toEqual({ text: "my draft" });
    });
    expect(result.current.isBrowsing).toBe(false);
  });

  it("leaves Down to the textarea when not browsing", async () => {
    state.messages = thread("first");
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.next()).toBeNull();
    });
  });

  it("reports browsing only while the box holds a history entry", async () => {
    state.messages = thread("first");
    const { result } = renderHook(() => usePromptHistory());

    expect(result.current.isBrowsing).toBe(false);
    await act(async () => {
      await result.current.previous("");
    });
    expect(result.current.isBrowsing).toBe(true);
    await act(async () => {
      await result.current.next();
    });
    expect(result.current.isBrowsing).toBe(false);
  });

  it("abandons the walk on reset, so the next Up starts from the newest", async () => {
    state.messages = thread("first", "second");
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("");
    });
    await act(async () => {
      await result.current.previous("");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.isBrowsing).toBe(false);
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "second" });
    });
  });

  it("skips assistant messages and attachment-only sends", async () => {
    state.messages = [
      user("typed"),
      assistant("reply"),
      // An attachment-only send carries no text to recall.
      { role: "user", content: [{ type: "image", image: "data:," }] },
      assistant("reply"),
    ];
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "typed" });
    });
    await act(async () => {
      expect(await result.current.previous("")).toBeNull();
    });
  });

  it("reads a user message stored as a bare string", async () => {
    state.messages = [{ role: "user", content: "plain" }];
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "plain" });
    });
  });

  it("joins the text parts of a multi-part prompt", async () => {
    state.messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "line one" },
          { type: "image", image: "data:," },
          { type: "text", text: "line two" },
        ],
      },
    ];
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toEqual({
        text: "line one\nline two",
      });
    });
  });

  it("pulls the previous page when the walk runs off the top", async () => {
    state.messages = thread("newest");
    state.hasMoreOlderMessages = true;
    const loadOlderMessages = vi.fn(() => {
      state.messages = [...thread("older"), ...state.messages];
      state.hasMoreOlderMessages = false;
      return Promise.resolve();
    });
    state.loadOlderMessages = loadOlderMessages;

    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "newest" });
    });
    expect(loadOlderMessages).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "older" });
    });
    expect(loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps paging while a page brings no prompt of its own", async () => {
    state.messages = thread("newest");
    state.hasMoreOlderMessages = true;
    const pages = [
      // A page of assistant-only messages carries nothing walkable.
      [assistant("a"), assistant("b")],
      thread("ancient"),
    ];
    const loadOlderMessages = vi.fn(() => {
      const page = pages.pop();
      if (page) state.messages = [...page, ...state.messages];
      state.hasMoreOlderMessages = pages.length > 0;
      return Promise.resolve();
    });
    state.loadOlderMessages = loadOlderMessages;

    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("");
    });
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "ancient" });
    });
    expect(loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("does not walk past a page that failed to bring anything", async () => {
    state.messages = thread("newest");
    state.hasMoreOlderMessages = true;
    // A refused or failed load leaves the list untouched — the store
    // keeps `hasMoreOlderMessages` on so the next scroll retries, which
    // would spin here if the walk didn't stop on its own.
    const loadOlderMessages = vi.fn(() => Promise.resolve());
    state.loadOlderMessages = loadOlderMessages;

    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("");
    });
    await act(async () => {
      expect(await result.current.previous("")).toBeNull();
    });
    expect(loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("treats a same-length page that brought new messages as progress", async () => {
    state.messages = [
      { ...user("newest"), id: "m2" },
      { ...assistant("re"), id: "m3" },
    ];
    state.hasMoreOlderMessages = true;
    // An adapter that pages by *replacing* the window rather than growing
    // it hands back a list of the same length. The count alone cannot
    // tell that from a load that brought nothing, so the walk would stop
    // here as if the thread had ended; the leading id can tell.
    const pages = [
      // Reached only if the same-length page above counts as progress.
      [...thread("ancient"), ...thread("older")],
      [
        { ...user("older"), id: "m0" },
        { ...assistant("re"), id: "m1" },
      ],
    ];
    const loadOlderMessages = vi.fn(() => {
      const page = pages.pop();
      if (page) state.messages = page;
      state.hasMoreOlderMessages = pages.length > 0;
      return Promise.resolve();
    });
    state.loadOlderMessages = loadOlderMessages;

    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "newest" });
    });
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "ancient" });
    });
    expect(loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("holds its place across a page landing at the front of the list", async () => {
    state.messages = thread("one", "two", "three");
    state.hasMoreOlderMessages = true;
    state.loadOlderMessages = () => {
      state.messages = [...thread("zero"), ...state.messages];
      state.hasMoreOlderMessages = false;
      return Promise.resolve();
    };

    const { result } = renderHook(() => usePromptHistory());

    for (const expected of ["three", "two", "one", "zero"]) {
      await act(async () => {
        expect(await result.current.previous("")).toEqual({ text: expected });
      });
    }
    // Walking forward again must retrace the same entries, even though
    // every index shifted when the page landed.
    for (const expected of ["one", "two", "three"]) {
      await act(async () => {
        expect(await result.current.next()).toEqual({ text: expected });
      });
    }
  });

  it("ignores a second step fired while a page is still on the wire", async () => {
    state.messages = thread("newest");
    state.hasMoreOlderMessages = true;
    let release: () => void = () => {};
    const landed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loadOlderMessages = vi.fn(async () => {
      await landed;
      state.messages = [...thread("older"), ...state.messages];
      state.hasMoreOlderMessages = false;
    });
    state.loadOlderMessages = loadOlderMessages;

    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("");
    });

    // Holding Up down repeats far faster than a page comes back. Without
    // the guard both steps would read the same depth and the second would
    // land on the same entry, silently eating one Up.
    await act(async () => {
      const first = result.current.previous("");
      const second = result.current.previous("");
      expect(await second).toBeNull();
      release();
      expect(await first).toEqual({ text: "older" });
    });
    expect(loadOlderMessages).toHaveBeenCalledTimes(1);

    // The guard lifts once the page lands, so the walk continues.
    await act(async () => {
      expect(await result.current.previous("")).toBeNull();
    });
  });

  it("restarts the walk from the newest entry after a send mid-walk", async () => {
    state.messages = thread("first", "second", "third");
    const { result } = renderHook(() => usePromptHistory());

    // Recall an entry...
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "third" });
    });
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "second" });
    });

    // ...and send it without touching the keyboard again. None of the
    // three send paths is a keystroke, so nothing resets the walk for us;
    // the appended message has to do it.
    state.messages = [...state.messages, user("second")];

    // Depth counts back from the end, so an unreset walk would resume at
    // depth 3 and hand back "second" again, skipping the message just
    // sent and the one before it. (The walk ends on the next step rather
    // than at the send itself: the store is read lazily, never subscribed
    // to, so nothing here observes the append until history is asked.)
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "second" });
    });
    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "third" });
    });
  });

  it("ends the walk when a send arrives before a Down step", async () => {
    state.messages = thread("first", "second");
    const { result } = renderHook(() => usePromptHistory());

    await act(async () => {
      await result.current.previous("draft");
    });
    state.messages = [...state.messages, user("second")];

    // The draft the walk was holding belongs to a list that no longer
    // exists, so Down goes back to the textarea rather than restoring it.
    await act(async () => {
      expect(await result.current.next()).toBeNull();
    });
    expect(result.current.isBrowsing).toBe(false);
  });

  it("keeps its place when its own paging grows the list", async () => {
    state.messages = thread("newest");
    state.hasMoreOlderMessages = true;
    state.loadOlderMessages = () => {
      state.messages = [...thread("older"), ...state.messages];
      state.hasMoreOlderMessages = false;
      return Promise.resolve();
    };

    const { result } = renderHook(() => usePromptHistory());

    // Growth from paging is the walk's own doing and must not read as a
    // send — otherwise the step after a page fetch would reset and start
    // over from the newest entry.
    for (const expected of ["newest", "older"]) {
      await act(async () => {
        expect(await result.current.previous("")).toEqual({ text: expected });
      });
    }
    await act(async () => {
      expect(await result.current.next()).toEqual({ text: "newest" });
    });
  });

  it("walks the newly sent prompt first, with no recording step", async () => {
    state.messages = thread("first");
    const { result } = renderHook(() => usePromptHistory());

    // A send appends the user message to the store — that alone puts it
    // at the head of the history.
    state.messages = [...state.messages, user("just sent")];

    await act(async () => {
      expect(await result.current.previous("")).toEqual({ text: "just sent" });
    });
  });
});
