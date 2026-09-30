import {
  isMcpImageBlock,
  mcpImageToDataUrl,
  type McpToolResultEnvelope,
} from "../../../shared/mcp-result";

/** One picture a tool result carries, inline or by attachment ref. */
export type ResultImage =
  | { kind: "inline"; src: string }
  | { kind: "ref"; ref: string };

/**
 * Collect the images a (parsed) tool result carries, in order. Two shapes
 * are read — the same two `persistGeneratedImage` writes:
 *
 * - the library's image-generation payload, `{ data: { base64 } }` inline
 *   or `{ data: { ref } }` once persisted;
 * - an MCP envelope whose `content` holds `{ type: "image", data,
 *   mimeType }` blocks inline or `{ type: "image", ref }` once persisted.
 *
 * Detection is by shape, not tool name, so an integrator's own image tool
 * and any MCP server returning pictures render the same way.
 */
export function collectResultImages(parsed: unknown): ResultImage[] {
  if (!parsed || typeof parsed !== "object") return [];
  const out: ResultImage[] = [];

  const data = (parsed as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const { base64, ref } = data as { base64?: unknown; ref?: unknown };
    if (typeof base64 === "string" && base64) {
      out.push({ kind: "inline", src: toImageSrc(base64) });
    } else if (typeof ref === "string" && ref) {
      out.push({ kind: "ref", ref });
    }
  }

  const content = (parsed as McpToolResultEnvelope).content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!isMcpImageBlock(block)) continue;
      const dataUrl = mcpImageToDataUrl(block);
      if (dataUrl) out.push({ kind: "inline", src: dataUrl });
      else if (typeof block.ref === "string") {
        out.push({ kind: "ref", ref: block.ref });
      }
    }
  }
  return out;
}

/** Turn a stored image value (raw base64 or data URL) into an `img` src. */
export function toImageSrc(value: string): string {
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

const OMITTED = "<base64 omitted>";

/**
 * Copy of a parsed result with every inline image payload replaced by a
 * short placeholder, for the raw-result view: a megabyte of base64 in a
 * `<pre>` is unreadable and slow to lay out. The picture itself is shown
 * separately. Results without inline images are returned as is.
 */
export function redactResultImages(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  let next: Record<string, unknown> | null = null;

  const data = (parsed as { data?: unknown }).data;
  if (
    data &&
    typeof data === "object" &&
    typeof (data as { base64?: unknown }).base64 === "string"
  ) {
    next = { ...(parsed as object), data: { ...data, base64: OMITTED } };
  }

  const content = (parsed as McpToolResultEnvelope).content;
  if (
    Array.isArray(content) &&
    content.some((b) => isMcpImageBlock(b) && typeof b.data === "string")
  ) {
    next = {
      ...(next ?? (parsed as object)),
      content: content.map((b) =>
        isMcpImageBlock(b) && typeof b.data === "string"
          ? { ...b, data: OMITTED }
          : b
      ),
    };
  }
  return next ?? parsed;
}
