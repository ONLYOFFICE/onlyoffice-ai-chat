// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
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

// Captures the observer callback so a test can say "the sentinel is in
// view now" without a layout engine.
let intersect: () => void = () => {};

class FakeIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    intersect = () =>
      cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as never
      );
  }
  observe() {}
  disconnect() {}
}

/** A scroll container with settable metrics — jsdom has no layout. */
const makeViewport = (scrollHeight: number, scrollTop: number) => {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", {
    value: scrollHeight,
    writable: true,
  });
  el.scrollTop = scrollTop;
  return el;
};

const setViewportHeight = (el: HTMLDivElement, height: number) => {
  Object.defineProperty(el, "scrollHeight", { value: height, writable: true });
};

describe("OlderMessages", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    messageState.messages = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
    }));
    messageState.hasMoreOlderMessages = true;
    messageState.isLoadingOlderMessages = false;
    messageState.loadOlderMessages = vi.fn().mockResolvedValue(undefined);
  });

  const renderSentinel = (viewport: HTMLDivElement) => {
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = viewport;
    return render(<OlderMessages viewportRef={ref} />);
  };

  it("asks for one page while the previous one is still settling", () => {
    const viewport = makeViewport(5000, 0);
    renderSentinel(viewport);

    intersect();
    intersect();
    intersect();

    // The sentinel stays at the top edge until the prepend is placed and
    // compensated — re-asking there would walk the whole thread at once.
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps the reading position when the page lands", () => {
    const viewport = makeViewport(5000, 300);
    const { rerender } = renderSentinel(viewport);

    intersect();

    // The page arrives: the store grows and the list gets taller.
    messageState.messages = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
    }));
    setViewportHeight(viewport, 9000);
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = viewport;
    rerender(<OlderMessages viewportRef={ref} />);

    // Same distance from the bottom as before: 5000 - 300 = 4700.
    expect(viewport.scrollTop).toBe(9000 - 4700);
  });

  it("arms again once the page has been placed", () => {
    const viewport = makeViewport(5000, 300);
    const { rerender } = renderSentinel(viewport);

    intersect();
    messageState.messages = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
    }));
    setViewportHeight(viewport, 9000);
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = viewport;
    rerender(<OlderMessages viewportRef={ref} />);

    intersect();

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("arms again after a load that brought nothing", async () => {
    const viewport = makeViewport(5000, 300);
    renderSentinel(viewport);

    intersect();
    // The request settled without growing the list — a failure, or a page
    // the store refused. Nothing will ever be laid out to compensate for.
    await Promise.resolve();
    await Promise.resolve();

    intersect();

    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("renders nothing once the thread's beginning is loaded", () => {
    messageState.hasMoreOlderMessages = false;
    const viewport = makeViewport(5000, 0);
    const { queryByTestId } = renderSentinel(viewport);
    expect(queryByTestId("older-messages-sentinel")).toBeNull();
  });
});
