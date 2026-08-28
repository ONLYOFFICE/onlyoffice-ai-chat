import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";

export type OlderMessagesProps = {
  /** The message viewport — the scroll container, or an element inside it. */
  viewportRef: RefObject<HTMLDivElement | null>;
};

/** Distance from the top at which the previous page starts loading. */
const TRIGGER_PX = 200;

/**
 * How long the reading position keeps being held against a landing page.
 * A hundred messages of markdown are not laid out in one frame — images,
 * fonts and code blocks keep changing the height for a while — so the
 * hold has to outlive the render rather than guess when it ends.
 */
const SETTLE_BUDGET_MS = 3000;

/** Frames of unchanged height that count as "the page has landed". */
const STABLE_FRAMES = 8;

/** How far up to look for the scroll container before giving up. */
const MAX_ANCESTORS = 4;

/** Tolerance for "the scroll offset is where we put it", in pixels. */
const EPSILON = 2;

type Pending = {
  /**
   * Distance from the bottom of the content, captured before the request.
   * Prepending only ever adds height above the reader, so this is the one
   * measure that survives it: restoring it puts every rendered message
   * back under the same pixel it was under before.
   */
  gap: number;
  /**
   * Scroll height at that moment. The page has landed when the content is
   * taller than this — the only honest signal available, since the store
   * grows several commits before the runtime renders what it added.
   */
  height: number;
  /** Message count at that moment — how a no-op load is recognised. */
  count: number;
};

const isScrollable = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1;

/**
 * The element that actually scrolls. The viewport the chat page hands over
 * is normally it, but a host (or a runtime primitive) can wrap the list in
 * its own overflow container — and anchoring to an element that cannot
 * scroll silently does nothing, which is exactly the failure this whole
 * component exists to prevent.
 */
const resolveScroller = (start: HTMLElement | null): HTMLElement | null => {
  let el: HTMLElement | null = start;
  for (let step = 0; el && step <= MAX_ANCESTORS; step += 1) {
    if (isScrollable(el)) return el;
    el = el.parentElement;
  }
  return start;
};

/**
 * Top-of-thread sentinel that pulls the previous page of messages.
 *
 * A paginated thread opens on its newest page, so everything above the
 * window is unloaded. When the reader comes within {@link TRIGGER_PX} of
 * the top the store prepends the page before it — the same infinite
 * scroll the chat list uses, mirrored upwards.
 *
 * Prepending shifts every rendered message down by the height of the new
 * page. Left alone that pins the reader to the top of the freshly loaded
 * page — the oldest of the new messages instead of the one they were
 * reading — and the sentinel, still at the top edge, immediately asks for
 * the page after that. So the distance to the bottom is captured before
 * the request and *held* while the page lays out, rather than restored in
 * one pass: the list is rendered by the runtime some commits later, and
 * its height keeps moving for as long as its content is still resolving.
 *
 * Renders nothing when the whole thread is already loaded — including
 * every host that runs without pagination.
 */
export const OlderMessages = ({ viewportRef }: OlderMessagesProps) => {
  const { Loader } = useComponents();
  const { useMessageStore } = useStores();
  const hasMoreOlderMessages = useMessageStore((s) => s.hasMoreOlderMessages);
  const isLoadingOlderMessages = useMessageStore(
    (s) => s.isLoadingOlderMessages
  );
  const messageCount = useMessageStore((s) => s.messages.length);

  const scrollerRef = useRef<HTMLElement | null>(null);
  // Set from the moment a page is requested until it has landed and the
  // reading position has been put back. While set, nothing else may ask
  // for a page — that is what keeps one gesture to one page.
  const pendingRef = useRef<Pending | null>(null);
  // Scroll offset this component wrote last, so its own writes are not
  // mistaken for the reader scrolling. `null` until it has written one —
  // a sentinel value would swallow the reader's first scroll if it landed
  // near it, and 0 (the top) is exactly where they are heading.
  const selfScrollTopRef = useRef<number | null>(null);
  // Set when a load changed nothing: without it a backend that keeps
  // answering with the same slice, or keeps failing, would be asked again
  // on the next frame forever. Cleared by a real scroll gesture.
  const needsGestureRef = useRef(false);

  const requestOlder = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || pendingRef.current || needsGestureRef.current) return;
    const store = useMessageStore.getState();
    if (!store.hasMoreOlderMessages) return;
    // A page shorter than the viewport leaves nothing to scroll: there is
    // no gesture coming, so the reach test has to pass on its own.
    if (isScrollable(scroller) && scroller.scrollTop > TRIGGER_PX) return;

    const pending: Pending = {
      gap: scroller.scrollHeight - scroller.scrollTop,
      height: scroller.scrollHeight,
      count: store.messages.length,
    };
    pendingRef.current = pending;
    void store
      .loadOlderMessages()
      .catch(() => undefined)
      .finally(() => {
        // A load that failed, was refused by the store, or came back with
        // nothing new leaves no page to hold a position against — the hold
        // below never runs, so the gate has to open here or the sentinel
        // stays shut for good. The count comes from the store, not from a
        // render closure: the store grows before React commits.
        const grew =
          useMessageStore.getState().messages.length !== pending.count;
        if (!grew && pendingRef.current === pending) {
          pendingRef.current = null;
          needsGestureRef.current = true;
        }
      });
  }, [useMessageStore]);

  useEffect(() => {
    const scroller = resolveScroller(viewportRef.current);
    scrollerRef.current = scroller;
    if (!hasMoreOlderMessages || !scroller) return;

    const onScroll = () => {
      // Ignore the scroll events caused by the hold below, or it would
      // read its own compensation as the reader arriving at the top.
      const self = selfScrollTopRef.current;
      if (
        pendingRef.current ||
        (self !== null && Math.abs(scroller.scrollTop - self) <= EPSILON)
      )
        return;
      needsGestureRef.current = false;
      requestOlder();
    };
    // The reader taking over mid-hold outranks the compensation: better a
    // jump than a viewport that fights the wheel.
    const onUserScroll = () => {
      if (!pendingRef.current) return;
      pendingRef.current = null;
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onUserScroll, { passive: true });
    scroller.addEventListener("touchmove", onUserScroll, { passive: true });
    // A window shorter than the viewport has no gesture coming: nothing
    // can be scrolled, so the only way the thread keeps filling is to ask
    // here. A scrollable one is left alone — a thread opens at its bottom,
    // but the runtime gets it there a commit or two after this runs, and
    // asking now would read that gap as "the reader is at the top".
    if (!isScrollable(scroller)) requestOlder();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", onUserScroll);
      scroller.removeEventListener("touchmove", onUserScroll);
    };
  }, [hasMoreOlderMessages, messageCount, requestOlder, viewportRef]);

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    // Resolved again rather than read from the effect above: that one runs
    // after this and is therefore always a commit behind, and a viewport
    // the runtime replaced would leave it pointing at a detached node —
    // where writing a scroll offset is silently lost.
    const scroller = resolveScroller(viewportRef.current) ?? scrollerRef.current;
    if (!scroller || !pending) return;
    scrollerRef.current = scroller;

    const startedAt = Date.now();
    let lastHeight = -1;
    let stableFrames = 0;
    let landed = false;
    let moved = false;
    let frame = 0;

    const release = () => {
      pendingRef.current = null;
      // The page brought no height, or this element would not take the
      // offset. Asking again right away is how one flick turns into a
      // hundred requests, so the next one waits for the reader.
      if (!moved) needsGestureRef.current = true;
      // Still within reach of the top (a page shorter than the viewport):
      // keep going, or the thread would stall until the reader scrolls.
      requestOlder();
    };

    const hold = () => {
      if (pendingRef.current !== pending) return; // the reader took over
      const height = scroller.scrollHeight;
      const expired = Date.now() - startedAt > SETTLE_BUDGET_MS;

      // Nothing has been rendered yet. Counting frames here is what made
      // the compensation a no-op: the store grows first, the runtime
      // renders a commit or several later, and a hold that measures
      // "stable" before that has measured the list it started with.
      if (!landed && height <= pending.height) {
        if (expired) {
          release();
          return;
        }
        frame = requestAnimationFrame(hold);
        return;
      }
      landed = true;

      const desired = Math.max(0, height - pending.gap);
      if (Math.abs(scroller.scrollTop - desired) > EPSILON) {
        scroller.scrollTop = desired;
        selfScrollTopRef.current = scroller.scrollTop;
        moved = true;
      }

      if (height === lastHeight) {
        stableFrames += 1;
      } else {
        lastHeight = height;
        stableFrames = 0;
      }

      if (stableFrames >= STABLE_FRAMES || expired) {
        release();
        return;
      }
      frame = requestAnimationFrame(hold);
    };
    hold();
    return () => cancelAnimationFrame(frame);
  }, [messageCount, requestOlder, viewportRef]);

  if (!hasMoreOlderMessages) return null;

  return (
    <div
      data-testid="older-messages-sentinel"
      className="flex shrink-0 items-center justify-center py-[8px]"
    >
      {isLoadingOlderMessages ? <Loader size={16} /> : null}
    </div>
  );
};
