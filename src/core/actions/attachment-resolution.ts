import type { ThreadMessageLike } from "@assistant-ui/react";
import { parseImageDataUrl } from "../../shared/image-data-url";
import {
  isMcpImageBlock,
  parseMcpEnvelope,
  type McpToolResultEnvelope,
} from "../../shared/mcp-result";
import type { Attachment, AttachmentsStorage } from "../storage";

/**
 * Marker payload embedded in `mimeType` (file) or `image` (image)
 * fields of a persisted ref-block. The resolver detects the `ref`
 * key and replaces the block with the hydrated inline form before
 * the provider sees it.
 */
interface RefMeta {
  ref: string;
  title: string;
  kind: "file" | "image";
  path?: string;
  type?: number;
}

/**
 * Build a persisted file-attachment block from a draft attachment.
 * Use this from the UI instead of inlining `data: content`.
 */
export function buildFileRefBlock(att: {
  id: string;
  title: string;
  path?: string;
  type?: number;
}) {
  const meta: RefMeta = {
    ref: att.id,
    title: att.title,
    kind: "file",
    path: att.path,
    type: att.type,
  };
  return {
    type: "file" as const,
    mimeType: JSON.stringify(meta),
    data: "",
  };
}

/**
 * Build a persisted image-attachment block from a draft attachment.
 * Use this from the UI instead of inlining `image: base64`.
 */
export function buildImageRefBlock(att: { id: string; title: string }) {
  const meta: RefMeta = {
    ref: att.id,
    title: att.title,
    kind: "image",
  };
  return {
    type: "image" as const,
    image: JSON.stringify(meta),
    name: att.title,
  };
}

/**
 * Try to parse a JSON-encoded {@link RefMeta} marker. Returns `null`
 * if the input doesn't look like a ref — including legacy inline
 * blocks, which fall through unchanged.
 */
function parseRef(value: unknown): RefMeta | null {
  if (typeof value !== "string" || value.length === 0) return null;
  // Refs are always serialized objects starting with `{` and carrying a
  // `"ref"` key. Base64 data URLs and legacy mimeType JSON never satisfy
  // the start-with-`{` check together with the `"ref"` substring, so
  // this avoids false positives without paying for `JSON.parse` first.
  if (value[0] !== "{" || !value.includes('"ref"')) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RefMeta>;
    if (
      typeof parsed?.ref === "string" &&
      typeof parsed?.title === "string" &&
      (parsed.kind === "file" || parsed.kind === "image")
    ) {
      return parsed as RefMeta;
    }
  } catch {
    /* not JSON — legacy inline block */
  }
  return null;
}

/**
 * Walk a list of `ThreadMessageLike`s, replace every ref-block with
 * its hydrated inline form (`{data: content, mimeType: JSON({path,type})}`
 * for files; `{image: base64, name: title}` for images). Legacy inline
 * blocks pass through untouched.
 *
 * Missing refs (deleted / orphaned attachments) collapse to a text
 * block with a `[attachment unavailable: <title>]` notice so the
 * provider doesn't choke on an empty payload.
 *
 * Issues a single batched `readManyByIds` regardless of message count.
 * The returned records may arrive in any order, contain gaps, or be
 * absent entirely — the resolver indexes them by `id` and treats every
 * unmatched ref as missing.
 */
export async function resolveAttachmentRefs(
  messages: ThreadMessageLike[],
  storage: AttachmentsStorage
): Promise<ThreadMessageLike[]> {
  const ids = collectRefIds(messages);
  if (ids.length === 0) return messages;

  const records = await storage.readManyByIds(ids);
  const map = new Map<string, Attachment>();
  if (Array.isArray(records)) {
    for (const rec of records) {
      if (rec && typeof rec.id === "string") map.set(rec.id, rec);
    }
  }

  return messages.map((msg) => hydrateMessage(msg, map));
}

/**
 * Extract ref ids from a single message's content blocks, in order
 * and de-duplicated. Used by `AIEngine.sendWithStream` to bind the
 * draft attachments to their owning message right after persistence.
 */
export function extractRefIdsFromMessage(msg: ThreadMessageLike): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const content = msg.content;
  if (typeof content === "string" || !Array.isArray(content)) return out;
  for (const part of content) {
    const meta = extractRefFromPart(part);
    if (meta && !seen.has(meta.ref)) {
      seen.add(meta.ref);
      out.push(meta.ref);
    }
  }
  return out;
}

export function collectRefIds(messages: ThreadMessageLike[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (ref: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    ids.push(ref);
  };
  for (const msg of messages) {
    const content = msg.content;
    if (typeof content === "string" || !Array.isArray(content)) continue;
    for (const part of content) {
      const meta = extractRefFromPart(part);
      if (meta) add(meta.ref);
      for (const ref of extractToolResultImageRefs(part)) add(ref);
    }
  }
  return ids;
}

/**
 * Persisted MCP tool result carrying image refs — see
 * `persistGeneratedImage`. Returns the parsed envelope and the refs it
 * holds, or `null` when the part is not a tool-call with such a result.
 */
function parseToolResultImageRefs(
  part: unknown
): { envelope: McpToolResultEnvelope; refs: string[] } | null {
  if (!part || typeof part !== "object") return null;
  const p = part as { type?: string; result?: unknown };
  if (p.type !== "tool-call" || typeof p.result !== "string") return null;
  // Persisted image blocks carry `"ref"`; a result without it has nothing
  // to hydrate, so skip the JSON.parse.
  if (!p.result.includes('"ref"')) return null;
  const envelope = parseMcpEnvelope(p.result);
  if (!envelope) return null;
  const refs: string[] = [];
  for (const block of envelope.content ?? []) {
    if (isMcpImageBlock(block) && typeof block.ref === "string") {
      refs.push(block.ref);
    }
  }
  return refs.length ? { envelope, refs } : null;
}

function extractToolResultImageRefs(part: unknown): string[] {
  return parseToolResultImageRefs(part)?.refs ?? [];
}

/**
 * Hydrate the image refs inside a tool-call part's MCP result back to
 * the wire form (`{ type: "image", data: <raw base64>, mimeType }`) so
 * the provider converters can attach the picture to the tool result.
 * A missing attachment collapses to a `[image unavailable]` text block.
 * Parts without image refs are returned unchanged.
 */
function hydrateToolResultImages(
  part: unknown,
  map: Map<string, Attachment>
): unknown {
  const parsed = parseToolResultImageRefs(part);
  if (!parsed) return part;
  const content = (parsed.envelope.content ?? []).map((block) => {
    if (!isMcpImageBlock(block) || typeof block.ref !== "string") return block;
    const rec = map.get(block.ref);
    const dataUrl = rec?.base64 ? parseImageDataUrl(rec.base64) : null;
    if (!rec?.base64) {
      return { type: "text", text: "[image unavailable]" };
    }
    return {
      type: "image",
      data: dataUrl ? dataUrl.base64 : rec.base64,
      mimeType: dataUrl?.mimeType ?? block.mimeType ?? "image/png",
    };
  });
  return {
    ...(part as object),
    result: JSON.stringify({ ...parsed.envelope, content }),
  };
}

function extractRefFromPart(part: unknown): RefMeta | null {
  if (!part || typeof part !== "object") return null;
  const p = part as { type?: string; mimeType?: unknown; image?: unknown };
  if (p.type === "file") return parseRef(p.mimeType);
  if (p.type === "image") return parseRef(p.image);
  return null;
}

function hydrateMessage(
  msg: ThreadMessageLike,
  map: Map<string, Attachment>
): ThreadMessageLike {
  const content = msg.content;
  if (typeof content === "string" || !Array.isArray(content)) return msg;

  const next = content.map((part) => {
    const meta = extractRefFromPart(part);
    if (!meta) return hydrateToolResultImages(part, map);
    const rec = map.get(meta.ref);
    if (!rec) return makeUnavailableBlock(meta.title);
    return meta.kind === "file"
      ? hydrateFileBlock(rec, meta)
      : hydrateImageBlock(rec, meta);
  });

  return { ...msg, content: next as ThreadMessageLike["content"] };
}

function hydrateFileBlock(rec: Attachment, meta: RefMeta) {
  return {
    type: "file" as const,
    mimeType: JSON.stringify({
      path: rec.path ?? meta.path ?? rec.title,
      type: rec.type ?? meta.type ?? 0,
    }),
    data: rec.content ?? "",
  };
}

function hydrateImageBlock(rec: Attachment, meta: RefMeta) {
  return {
    type: "image" as const,
    image: rec.base64 ?? "",
    name: rec.title ?? meta.title,
  };
}

function makeUnavailableBlock(title: string) {
  return {
    type: "text" as const,
    text: `[attachment unavailable: ${title}]`,
  };
}
