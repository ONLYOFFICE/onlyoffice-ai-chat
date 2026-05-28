/**
 * Decode an `data:image/svg+xml,...` URL produced by Vite back into raw
 * SVG markup. Handles both URI-encoded form (Vite default) and the
 * `;base64,` form that Vite falls back to when the SVG contains
 * `<text>`, `<foreignObject>` or nested-quote attribute values.
 *
 * Vite's encoding (see vite/src/node/plugins/asset.ts `svgToDataURL`):
 *   `"` → `'`, then `% # < >` percent-encoded, runs of whitespace → `%20`.
 *
 * Returns the markup string, or `null` when `src` is not an SVG data URL.
 */
export const decodeSvgDataUrl = (src: string): string | null => {
  const utf = "data:image/svg+xml,";
  const utfCharset = "data:image/svg+xml;utf8,";
  const base64 = "data:image/svg+xml;base64,";
  if (src.startsWith(base64)) {
    try {
      return atob(src.slice(base64.length));
    } catch {
      return null;
    }
  }
  if (src.startsWith(utfCharset)) {
    return safeDecode(src.slice(utfCharset.length));
  }
  if (src.startsWith(utf)) {
    return safeDecode(src.slice(utf.length));
  }
  return null;
};

const safeDecode = (s: string): string | null => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};
