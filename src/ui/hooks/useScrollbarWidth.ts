import { useEffect, useState } from "react";

// Cached across every call — the scrollbar width is constant for the
// browser/OS session, so we only ever probe the DOM once.
let cached: number | null = null;

/**
 * Measures the browser's real scrollbar width (cached). Returns 8 during SSR
 * (no `document`). The probe inherits the same global scrollbar styling as
 * the widget's surfaces (`scrollbar-width: thin` + the `::-webkit-scrollbar`
 * rule), so the result matches what the real viewports render: 8px on WebKit,
 * Firefox's `thin` metric, or 0 for zero-width overlay scrollbars.
 */
export const measureScrollbarWidth = (): number => {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return 8;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;";
  document.body.appendChild(probe);
  cached = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return cached;
};

/**
 * Returns the browser's real scrollbar width in px, measured once after mount
 * (8 until then, and during SSR). Callers typically expose it as the
 * `--scrollbar-width` CSS custom property so layout can line up across a
 * scrolled surface (whose content box is narrowed by the scrollbar) and a
 * non-scrolled one — see how `ThemeProvider` publishes it.
 */
export const useScrollbarWidth = (): number => {
  const [width, setWidth] = useState<number>(() => cached ?? 8);
  useEffect(() => {
    const measured = measureScrollbarWidth();
    setWidth((prev) => (prev === measured ? prev : measured));
  }, []);
  return width;
};

export default useScrollbarWidth;
