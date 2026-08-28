import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";

export type OlderMessagesProps = {
  /** The scrolling message viewport — observer root and scroll anchor. */
  viewportRef: RefObject<HTMLDivElement | null>;
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
 * once the page has been laid out.
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
  // Distance from the bottom of the scroll content, captured just before
  // a page is requested. `null` means "no prepend is pending", which is
  // what keeps the restore below from firing on an appended message.
  const anchorRef = useRef<number | null>(null);

  // `messageCount` in the deps reconnects the observer after every
  // prepended page: `observe` reports the current intersection state, so
  // a page shorter than the viewport keeps loading without asking the
  // user for another scroll gesture.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const viewport = viewportRef.current;
    if (!hasMoreOlderMessages || !sentinel || !viewport) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        anchorRef.current = viewport.scrollHeight - viewport.scrollTop;
        void loadOlderMessages().catch(() => undefined);
      },
      { root: viewport, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreOlderMessages, loadOlderMessages, messageCount, viewportRef]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    if (!viewport || anchor === null) return;
    viewport.scrollTop = viewport.scrollHeight - anchor;
    anchorRef.current = null;
  }, [messageCount, viewportRef]);

  // A request that failed (or returned nothing new) leaves the anchor
  // armed with no prepend to compensate; drop it, or the next appended
  // message would scroll the thread to a stale offset.
  useEffect(() => {
    if (!isLoadingOlderMessages) anchorRef.current = null;
  }, [isLoadingOlderMessages]);

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
