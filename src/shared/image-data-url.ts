import logger from "./logger";

/** Parsed pieces of a `data:<mime>;base64,<payload>` URL. */
export interface ParsedImageDataUrl {
  mimeType: string;
  base64: string;
}

/**
 * Parse a `data:<mime>;base64,<payload>` URL into its mime type and
 * base64 payload. Returns `null` when the string is not a base64 data
 * URL or carries an empty payload.
 */
export const parseImageDataUrl = (value: string): ParsedImageDataUrl | null => {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

/** Whether `value` is an inlined base64 data URL a provider can send. */
export const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && parseImageDataUrl(value) !== null;

/**
 * Guard an image content part's value on its way to a provider.
 *
 * By the time a message reaches a provider adapter, `resolveAttachmentRefs`
 * has run on every dispatch path, so a legitimate image is an inlined
 * base64 data URL. A value that is still a ref marker (`{"ref":…}`) or an
 * http(s) URL must never be forwarded verbatim: the model can't read the
 * ref, and the host's pre-signed URLs are session-gated and unreachable by
 * the provider. Such a value is dropped (the caller substitutes an inert
 * placeholder) and logged.
 *
 * An empty string is the benign 0-byte-attachment case and is dropped
 * silently. Only a non-empty non-data value triggers the warning.
 *
 * @returns the parsed data URL, or `null` for the caller to drop/substitute.
 */
export const parseGuardedImageDataUrl = (
  value: unknown
): ParsedImageDataUrl | null => {
  if (typeof value === "string") {
    const parsed = parseImageDataUrl(value);
    if (parsed) return parsed;
    if (value.length > 0) {
      logger.warn(
        "ai-chat: dropping image content part that is not an inlined data: URL " +
          "(resolveAttachmentRefs should have hydrated it); prefix=",
        value.slice(0, 48)
      );
    }
  }
  return null;
};
