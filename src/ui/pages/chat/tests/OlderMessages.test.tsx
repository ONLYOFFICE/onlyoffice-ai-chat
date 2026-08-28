// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createRef } from "react";

const messageState = {
  messages: [] as { id: string }[],
  hasMoreOlderMessages: true,
  isLoadingOlderMessages: false,
  loadOlderMessages: vi.fn().mockResolvedValue(undefined),
};

const makeStore = <T,>(state: T) => {
  const hook = (selector?: (s: T) => unknown) =>
    selector ? selector(state) : state;
  hook.getState = () => state;
  return hook;
};

vi.mock("../../../store/context", () => ({
  useStores: () => ({ useMessageStore: makeStore(messageState) }),
}));

vi.mock("../../../providers/ComponentsProvider", () => ({
  useComponents: () => ({ Loader: () => <span data-testid="loader" /> }),
}));

import { OlderMessages } from "../sub-components/OlderMessages";

/** Manual frame clock: jsdom has no rendering loop to wait for. */
let frames: (() => void)[] = [];
const runFrames = (count: number) => {
  for (let i = 0; i < count; i += 1) {
    const due = frames;
    frames = [];
    due.forEach((cb) => cb());
  }
};

/** A scroll container with settable metrics — jsdom has no layout. */
const makeScroller = (scrollHeight: number, scrollTop: number) => {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    value: 800,
    writable: true,
    configurable: true,
  });
  el.scrollTop = scrollTop;
  document.body.appendChild(el);
  return el;
};

const setHeight = (el: HTMLDivElement, height: number) => {
  Object.defineProperty(el, "scrollHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
};

const scrollTo = (el: HTMLDivElement, top: number) => {
  el.scrollTop = top;
  el.dispatchEvent(new Event("scroll"));
};

describe("OlderMessages", () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    document.body.innerHTML = "";
    messageState.messages = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
    }));
    messageState.hasMoreOlderMessages = true;
    messageState.isLoadingOlderMessages = false;
    messageState.loadOlderMessages = vi.fn().mockResolvedValue(undefined);
  });

  /** Mount the sentinel against `scroller`, already scrolled down. */
  const renderSentinel = (scroller: HTMLDivElement) => {
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = scroller;
    const view = render(<OlderMessages viewportRef={ref} />);
    return {
      ...view,
      /** Re-render as the store would after a page was prepended. */
      grow: (count: number, height: number) => {
        messageState.messages = Array.from({ length: count }, (_, i) => ({
          id: `m${i}`,
        }));
        setHeight(scroller, height);
        const next = createRef<HTMLDivElement>();
        (next as { current: HTMLDivElement | null }).current = scroller;
        view.rerender(<OlderMessages viewportRef={next} />);
      },
    };
  };

  it("asks for a page when the reader comes within reach of the top", () => {
    const scroller = makeScroller(5000, 4000);
    renderSentinel(scroller);
    expect(messageState.loadOlderMessages).not.toHaveBeenCalled();

    scrollTo(scroller, 150);

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("asks for one page however hard the reader scrolls", () => {
    const scroller = makeScroller(5000, 4000);
    renderSentinel(scroller);

    scrollTo(scroller, 150);
    scrollTo(scroller, 80);
    scrollTo(scroller, 0);

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps the reading position when the page lands", () => {
    const scroller = makeScroller(5000, 0);
    const { grow } = renderSentinel(scroller);

    scrollTo(scroller, 0);
    grow(200, 9000);

    // The reader was 5000px from the bottom; the page added 4000px above.
    expect(scroller.scrollTop).toBe(4000);
  });

  it("holds the position while the page keeps laying out", () => {
    const scroller = makeScroller(5000, 0);
    const { grow } = renderSentinel(scroller);

    scrollTo(scroller, 0);
    grow(200, 9000);
    // Markdown, images and code blocks resolve over the next frames.
    setHeight(scroller, 9600);
    runFrames(1);

    expect(scroller.scrollTop).toBe(4600);
  });

  it("waits for the page the runtime has not rendered yet", () => {
    const scroller = makeScroller(5000, 0);
    const { grow } = renderSentinel(scroller);

    scrollTo(scroller, 0);
    // The store has the page, but the runtime renders it several commits
    // later: the height is still the one the reader asked from.
    grow(200, 5000);
    runFrames(12);
    expect(scroller.scrollTop).toBe(0);

    setHeight(scroller, 9000);
    runFrames(1);

    expect(scroller.scrollTop).toBe(4000);
  });

  it("gives up on a page that never lands", () => {
    const scroller = makeScroller(5000, 0);
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(0);
    const { grow } = renderSentinel(scroller);

    scrollTo(scroller, 0);
    grow(200, 5000);
    now.mockReturnValue(5000); // past the settle budget
    runFrames(1);
    now.mockRestore();

    // The hold let go, so the reader is not locked out of the thread.
    scrollTo(scroller, 60);
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("arms again once the page has settled", () => {
    const scroller = makeScroller(5000, 0);
    const { grow } = renderSentinel(scroller);

    scrollTo(scroller, 0);
    grow(200, 9000);
    runFrames(12); // height stops moving, the hold releases

    scrollTo(scroller, 100);

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("does not walk the thread when nothing can be compensated", () => {
    // A container that does not scroll: writes to `scrollTop` are lost,
    // so the reader can never be moved away from the top edge.
    const scroller = makeScroller(400, 0);
    Object.defineProperty(scroller, "scrollTop", {
      get: () => 0,
      set: () => {},
      configurable: true,
    });
    const { grow } = renderSentinel(scroller);

    grow(200, 400);
    runFrames(12);

    // One page on mount, and no runaway chain after it.
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps loading while the loaded window is shorter than the viewport", async () => {
    const scroller = makeScroller(400, 0);
    const { grow } = renderSentinel(scroller);

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
    grow(200, 700); // still nothing to scroll, but the reader was moved
    runFrames(12);

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("retries after a load that brought nothing only on a real gesture", async () => {
    const scroller = makeScroller(5000, 0);
    renderSentinel(scroller);

    await act(async () => {
      scrollTo(scroller, 0);
    });
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);

    scrollTo(scroller, 60);

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("renders nothing once the thread's beginning is loaded", () => {
    messageState.hasMoreOlderMessages = false;
    const scroller = makeScroller(5000, 0);
    const { queryByTestId } = renderSentinel(scroller);
    expect(queryByTestId("older-messages-sentinel")).toBeNull();
  });
});
