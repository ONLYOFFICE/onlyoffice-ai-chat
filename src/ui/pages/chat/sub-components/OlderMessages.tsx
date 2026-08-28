import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";

export type OlderMessagesProps = {
  /** The scrolling message viewport — observer root and scroll anchor. */
  viewportRef: RefObject<HTMLDivElement | null>;
};

/**
 * How long to keep looking for the prepended page in the layout before
 * giving up on compensating for it (~0.6s at 60fps). The list is rendered
 * by the runtime a commit or two after the store grows, so the height the
 * anchor needs does not exist in the first frame.
 */
const MAX_SETTLE_FRAMES = 40;

/** Distance from the top at which the previous page starts loading. */
const TRIGGER_MARGIN = "200px";

type Anchor = {
  /** Scroll height captured before the page was requested. */
  height: number;
  /** Scroll offset captured before the page was requested. */
  top: number;
  /** Message count at that moment — how a no-op load is recognised. */
  count: number;
};

/**
 * Top-of-thread sentinel that pulls the previous page of messages.
 *
 * A paginated thread opens on its newest page, so everything above the
 * window is unloaded. When this sentinel comes within reach of the
 * viewport's top edge the store prepends the page before it — the same
 * infinite-scroll shape the chat list uses, mirrored upwards.
 *
 * Prepending shifts every rendered message down by the height of the new
 * page, which would yank the reader away from what they were reading, so
 * the distance to the bottom is captured before the request and restored
 * once the page has actually been laid out.
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
  const loadOlderMessages = useMessageStore((s) => s.loadOlderMessages);
  const messageCount = useMessageStore((s) => s.messages.length);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Set while a prepend is in flight or still settling into the layout.
  // `null` means "nothing pending", which is both what lets the sentinel
  // ask for the next page and what keeps the restore below from firing on
  // an ordinary appended message.
  const anchorRef = useRef<Anchor | null>(null);
  const [armToken, setArmToken] = useState(0);

  // An observer reports the intersection state once when it starts
  // observing and then only on changes. Every gate below drops an
  // intersection that was reported while a page was pending, so releasing
  // the gate has to come with a fresh observer: without it a reader left
  // sitting at the top edge — a page shorter than the viewport, a
  // compensation that found nothing to compensate — would never be asked
  // about again, and the thread would stop loading until they scrolled.
  const release = useCallback(() => {
    anchorRef.current = null;
    setArmToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const viewport = viewportRef.current;
    if (!hasMoreOlderMessages || !sentinel || !viewport) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // Until the last page has been placed and the scroll position
        // compensated, the sentinel is still sitting at the top edge —
        // asking again here would walk the whole thread in one gesture.
        if (anchorRef.current) return;
        const anchor: Anchor = {
          height: viewport.scrollHeight,
          top: viewport.scrollTop,
          count: messageCount,
        };
        anchorRef.current = anchor;
        void loadOlderMessages()
          .catch(() => undefined)
          .finally(() => {
            // A load that failed, was refused by the store, or came back
            // with nothing new leaves no prepend to compensate for — the
            // settle pass below never runs, so release the anchor here or
            // the sentinel stays disarmed for good. The count is read from
            // the store, not from this render's closure: the store grows
            // before React commits, and a stale closure would release an
            // anchor that is still needed.
            const grew =
              useMessageStore.getState().messages.length !== anchor.count;
            if (!grew && anchorRef.current === anchor) release();
          });
      },
      { root: viewport, rootMargin: TRIGGER_MARGIN }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    armToken,
    hasMoreOlderMessages,
    loadOlderMessages,
    messageCount,
    release,
    useMessageStore,
    viewportRef,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !anchorRef.current) return;

    let frames = 0;
    let frame = 0;
    const settle = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      if (viewport.scrollHeight > anchor.height) {
        // Keep the same distance from the bottom: everything the reader
        // was looking at stays exactly where it was.
        viewport.scrollTop =
          viewport.scrollHeight - (anchor.height - anchor.top);
        release();
        return;
      }
      if (++frames > MAX_SETTLE_FRAMES) {
        release();
        return;
      }
      frame = requestAnimationFrame(settle);
    };
    settle();
    return () => cancelAnimationFrame(frame);
  }, [messageCount, release, viewportRef]);

  if (!hasMoreOlderMessages) return null;

  return (
    <div
      ref={sentinelRef}
      data-testid="older-messages-sentinel"
      className="flex shrink-0 items-center justify-center py-[8px]"
    >
      {isLoadingOlderMessages ? <Loader size={16} /> : null}
    </div>
  );
};
