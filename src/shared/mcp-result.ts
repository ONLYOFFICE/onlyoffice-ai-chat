/**
 * Serialise an MCP `tools/call` result for the model. `structuredContent`
 * duplicates the `content` text blocks, so it is stripped to save
 * tokens; the rest of the result is returned as a JSON string.
 *
 * Provider SDKs require string tool results, and the serialised
 * result is what's stored on the tool-call message part.
 */
export function serializeMcpToolResult(result: unknown): string {
  return JSON.stringify(stripStructuredContent(result));
}

/** Return `result` without its `structuredContent` field, if it has one. */
export function stripStructuredContent(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }
  if (!("structuredContent" in result)) return result;
  const { structuredContent, ...rest } = result as Record<string, unknown>;
  void structuredContent;
  return rest;
}

/**
 * An `image` block of an MCP `tools/call` result — either the wire form
 * (`data` = raw base64, `mimeType`) or the persisted form in which the
 * payload has been moved to `storage.attachments` and only `ref` (the
 * attachment id) remains. Both forms carry `mimeType`.
 */
export interface McpImageBlock {
  type: "image";
  data?: string;
  mimeType?: string;
  ref?: string;
}

/** MCP tool result envelope — the parts this library reads. */
export interface McpToolResultEnvelope {
  content?: unknown[];
  isError?: boolean;
  [key: string]: unknown;
}

/** Whether `block` is an MCP `image` content block (either form). */
export function isMcpImageBlock(block: unknown): block is McpImageBlock {
  if (!block || typeof block !== "object") return false;
  const b = block as { type?: unknown; data?: unknown; ref?: unknown };
  return (
    b.type === "image" &&
    (typeof b.data === "string" || typeof b.ref === "string")
  );
}

/**
 * Parse a serialised tool result into an MCP envelope with a `content`
 * array. Returns `null` for anything else (a non-JSON string, an error
 * envelope, the library's own `{ data: … }` payloads), so callers can
 * skip cheaply. The `"image"` substring check avoids `JSON.parse` on
 * the common text-only result.
 */
export function parseMcpEnvelope(
  result: unknown
): McpToolResultEnvelope | null {
  let parsed: unknown = result;
  if (typeof result === "string") {
    if (result[0] !== "{" || !result.includes('"image"')) return null;
    try {
      parsed = JSON.parse(result);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const env = parsed as McpToolResultEnvelope;
  if (!Array.isArray(env.content)) return null;
  return env;
}

/** Inline image a tool returned, ready for a provider's image block. */
export interface ToolResultImage {
  /** `data:<mime>;base64,<payload>` URL. */
  dataUrl: string;
  mimeType: string;
}

const DEFAULT_IMAGE_MIME = "image/png";

/** Build a data URL from an MCP image block carrying inline base64. */
export function mcpImageToDataUrl(block: McpImageBlock): string | null {
  if (typeof block.data !== "string" || block.data.length === 0) return null;
  if (block.data.startsWith("data:")) return block.data;
  return `data:${block.mimeType || DEFAULT_IMAGE_MIME};base64,${block.data}`;
}

/** Placeholder left in the text result where an image block was. */
export const IMAGE_ATTACHED_TEXT = "[image attached]";

/**
 * Split a serialised tool result into the text the provider sends as
 * the tool result body and the images it must attach alongside.
 *
 * An MCP envelope whose `content` holds inline `image` blocks has those
 * blocks swapped for a `[image attached]` text block; the images come
 * back as data URLs for the provider to forward in its own native form
 * (Anthropic `tool_result` image block, OpenAI `image_url` user part,
 * GenAI `inlineData`). A result without inline images is returned
 * unchanged with an empty `images` list, so every provider can call this
 * unconditionally.
 *
 * Images still in persisted `ref` form (not hydrated) are left in place —
 * `resolveAttachmentRefs` hydrates them before the provider runs; an
 * unresolved leftover stays a tiny JSON marker the model can read past.
 */
export function splitToolResultImages(result: string): {
  text: string;
  images: ToolResultImage[];
} {
  const env = parseMcpEnvelope(result);
  if (!env) return { text: result, images: [] };

  const images: ToolResultImage[] = [];
  const content = env.content!.map((block) => {
    if (!isMcpImageBlock(block)) return block;
    const dataUrl = mcpImageToDataUrl(block);
    if (!dataUrl) return block;
    images.push({ dataUrl, mimeType: block.mimeType || DEFAULT_IMAGE_MIME });
    return { type: "text", text: IMAGE_ATTACHED_TEXT };
  });

  if (images.length === 0) return { text: result, images: [] };
  return { text: JSON.stringify({ ...env, content }), images };
}
