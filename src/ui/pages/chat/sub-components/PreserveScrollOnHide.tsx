import { useEffect, type RefObject } from "react";

export type PreserveScrollOnHideProps = {
  /** The message viewport — the scroll container itself. */
  viewportRef: RefObject<HTMLDivElement | null>;
};

/** Tolerance for "the scroll offset is already where we want it", in pixels. */
const EPSILON = 2;

/** How long a restore keeps being reapplied after the viewport comes back. */
const SETTLE_BUDGET_MS = 1000;

/** Frames of unchanged height that count as "the layout has settled". */
const STABLE_FRAMES = 5;

const isCollapsed = (el: HTMLElement) =>
  el.clientHeight === 0 && el.scrollHeight === 0;

/**
 * Holds the reading position across a host hiding the chat.
 *
 * Every host that keeps the chat mounted but off-screen hides it with
 * `display: none` — the DesktopEditors start page swaps to Home that way,
 * and the editor panel does the same. A collapsed element measures
 * `clientHeight === 0` and `scrollHeight === 0`, which the runtime's own
 * autoscroll reads as "the thread is scrolled to its end": it keeps an
 * `isAtBottom` flag updated from `scrollHeight <= clientHeight`, and that
 * comparison is `0 <= 0` while hidden. On the way back the flag is still
 * set, the resize observer fires as the viewport regains its size, and the
 * thread is scrolled to the bottom — losing wherever the reader was.
 *
 * So the offset is captured on the way out and written back on the way in.
 * The restore is *held* for a few frames rather than applied once: the
 * viewport regains its height a frame before its content is laid out
 * again, and the runtime's autoscroll runs in that same window — a single
 * write would land before it and be overwritten by it.
 *
 * A reader who was already at the bottom is left alone: nothing is
 * captured, so the thread keeps following new messages as it should.
 *
 * Renders nothing.
 */
export const PreserveScrollOnHide = ({
  viewportRef,
}: PreserveScrollOnHideProps) => {
  useEffect(() => {
    const scroller = viewportRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;

    // Distance from the bottom of the content, tracked while the viewport
    // is visible. Measuring from the bottom is what survives the round
    // trip: content may still resolve after it comes back. It has to be
    // kept up to date on every scroll rather than read when the viewport
    // collapses — by the time a resize is observed the element is already
    // hidden, and a collapsed element measures nothing but zeroes.
    let gap: number | null = null;
    // Whether the last visible measurement had the reader at the end. At
    // the bottom nothing is restored: following new messages is right.
    let wasAtBottom = true;
    let wasCollapsed = isCollapsed(scroller);
    let frame = 0;
    // Set while a restore is writing offsets, so its own writes are not
    // recorded as the reader scrolling somewhere else.
    let restoring = false;

    const measure = () => {
      if (isCollapsed(scroller) || restoring) return;
      wasAtBottom =
        Math.abs(
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
        ) < 1;
      gap = wasAtBottom ? null : scroller.scrollHeight - scroller.scrollTop;
    };

    measure();
    scroller.addEventListener("scroll", measure, { passive: true });

    const restore = (target: number) => {
      const startedAt = Date.now();
      let lastHeight = -1;
      let stableFrames = 0;

      restoring = true;
      const hold = () => {
        if (isCollapsed(scroller)) {
          restoring = false;
          return;
        }
        const height = scroller.scrollHeight;
        const desired = Math.max(0, height - target);
        if (Math.abs(scroller.scrollTop - desired) > EPSILON) {
          scroller.scrollTop = desired;
        }

        if (height === lastHeight) {
          stableFrames += 1;
        } else {
          lastHeight = height;
          stableFrames = 0;
        }

        if (
          stableFrames >= STABLE_FRAMES ||
          Date.now() - startedAt > SETTLE_BUDGET_MS
        ) {
          restoring = false;
          return;
        }
        frame = requestAnimationFrame(hold);
      };
      hold();
    };

    const observer = new ResizeObserver(() => {
      const collapsed = isCollapsed(scroller);
      if (collapsed === wasCollapsed) return;
      wasCollapsed = collapsed;

      if (collapsed) {
        // The offset was measured while still visible; nothing to read
        // off a collapsed element. Any restore in flight is now moot.
        cancelAnimationFrame(frame);
        restoring = false;
        return;
      }

      // At the bottom on the way out, so let the runtime keep it there.
      if (wasAtBottom || gap === null) return;
      restore(gap);
    });

    observer.observe(scroller);
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", measure);
      cancelAnimationFrame(frame);
    };
  }, [viewportRef]);

  return null;
};
