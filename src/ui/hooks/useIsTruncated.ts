import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether a `truncate`d element is actually clipping its text, so a
 * tooltip can be offered only for labels the user cannot fully read.
 *
 * Returns a callback ref — the element may mount after the row is hovered
 * (list rows render their label lazily), and a callback ref re-runs the
 * measurement on every attach. A `ResizeObserver` keeps the flag current when
 * the panel is resized or the label text changes.
 */
export const useIsTruncated = <T extends HTMLElement = HTMLElement>() => {
  const [isTruncated, setIsTruncated] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback((el: T) => {
    // `scrollWidth` rounds to an integer while `clientWidth` does not, so a
    // sub-pixel layout can report a 1px overflow for text that fits.
    setIsTruncated(el.scrollWidth - el.clientWidth > 1);
  }, []);

  const ref = useCallback(
    (el: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!el) {
        setIsTruncated(false);
        return;
      }

      measure(el);

      if (typeof ResizeObserver === "undefined") return;

      const observer = new ResizeObserver(() => measure(el));
      observer.observe(el);
      observerRef.current = observer;
    },
    [measure]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return { ref, isTruncated };
};

export default useIsTruncated;
