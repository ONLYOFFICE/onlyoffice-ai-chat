// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createRef } from "react";

import { PreserveScrollOnHide } from "../sub-components/PreserveScrollOnHide";

/** Manual frame clock: jsdom has no rendering loop to wait for. */
let frames: (() => void)[] = [];
const runFrames = (count: number) => {
  for (let i = 0; i < count; i += 1) {
    const due = frames;
    frames = [];
    due.forEach((cb) => cb());
  }
};

/** Observers created by the component, so a resize can be simulated. */
let observerCallbacks: (() => void)[] = [];

const setMetrics = (
  el: HTMLDivElement,
  { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }
) => {
  Object.defineProperty(el, "scrollHeight", {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    value: clientHeight,
    writable: true,
    configurable: true,
  });
};

/**
 * A scroll container with settable metrics — jsdom has no layout, and it
 * does not clamp `scrollTop` to the scrollable range the way a browser
 * does, so the clamp is modelled here: without it a restore that overshoots
 * would look like it worked.
 */
const makeViewport = (scrollTop: number) => {
  const el = document.createElement("div") as HTMLDivElement;
  setMetrics(el, { scrollHeight: 5000, clientHeight: 800 });
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      // A collapsed element keeps whatever offset it is given: the browser
      // does not reset `scrollTop` while an element is `display: none`.
      if (el.scrollHeight === 0 && el.clientHeight === 0) {
        top = Math.max(0, value);
        return;
      }
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      top = Math.min(Math.max(0, value), max);
    },
    configurable: true,
  });
  el.scrollTop = scrollTop;
  document.body.appendChild(el);
  return el;
};

/** The reader scrolling: the component tracks the offset via this event. */
const scrollTo = (el: HTMLDivElement, top: number) => {
  el.scrollTop = top;
  act(() => {
    el.dispatchEvent(new Event("scroll"));
  });
};

/** The host hiding the panel: `display: none` zeroes both metrics. */
const hide = (el: HTMLDivElement) => {
  setMetrics(el, { scrollHeight: 0, clientHeight: 0 });
  act(() => observerCallbacks.forEach((cb) => cb()));
};

const show = (el: HTMLDivElement, scrollHeight = 5000) => {
  setMetrics(el, { scrollHeight, clientHeight: 800 });
  act(() => observerCallbacks.forEach((cb) => cb()));
};

describe("PreserveScrollOnHide", () => {
  beforeEach(() => {
    frames = [];
    observerCallbacks = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          observerCallbacks.push(cb);
        }
        observe() {}
        disconnect() {}
      }
    );
    document.body.innerHTML = "";
  });

  const mount = (el: HTMLDivElement) => {
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = el;
    render(<PreserveScrollOnHide viewportRef={ref} />);
  };

  it("restores the reading position after the host hides and shows the chat", () => {
    const el = makeViewport(4200);
    mount(el);
    // Scrolled up: 1000px down a 5000px thread, so 4000px from the bottom.
    scrollTo(el, 1000);

    hide(el);
    // The runtime's autoscroll pins a collapsed viewport to the end.
    el.scrollTop = 0;
    show(el);
    act(() => runFrames(1));

    expect(el.scrollTop).toBe(1000);
  });

  it("holds the position while the content is still laying out", () => {
    const el = makeViewport(4200);
    mount(el);
    scrollTo(el, 1000);

    hide(el);
    // Content not fully resolved yet: the same 4000px gap puts the reader
    // at the top of a 4000px-tall thread.
    show(el, 4000);
    act(() => runFrames(1));
    expect(el.scrollTop).toBe(0);

    // Late layout brings the thread back to its full height, and the
    // offset has to follow it rather than stay where it first landed.
    setMetrics(el, { scrollHeight: 5000, clientHeight: 800 });
    act(() => runFrames(1));
    expect(el.scrollTop).toBe(1000);
  });

  it("reapplies the offset when the runtime scrolls to the bottom first", () => {
    const el = makeViewport(4200);
    mount(el);
    scrollTo(el, 1000);

    hide(el);
    show(el);
    act(() => runFrames(1));

    // The runtime's resize-driven autoscroll lands a frame later.
    el.scrollTop = 4200;
    act(() => runFrames(1));

    expect(el.scrollTop).toBe(1000);
  });

  it("leaves a reader who was at the bottom following new messages", () => {
    // scrollHeight - scrollTop - clientHeight === 0 → at the bottom.
    const el = makeViewport(4200);
    mount(el);
    scrollTo(el, 4200);

    hide(el);
    el.scrollTop = 4200;
    show(el);
    act(() => runFrames(2));

    // Nothing was captured, so nothing is written back.
    expect(el.scrollTop).toBe(4200);
  });

  it("stops holding once the height has settled", () => {
    const el = makeViewport(4200);
    mount(el);
    scrollTo(el, 1000);

    hide(el);
    show(el);
    act(() => runFrames(10));

    // The hold has released: a later scroll by the reader stands.
    scrollTo(el, 2500);
    act(() => runFrames(5));
    expect(el.scrollTop).toBe(2500);
  });
});
