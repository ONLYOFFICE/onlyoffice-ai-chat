import type { ThreadMessageLike } from "@assistant-ui/react";
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
export function buildImageRefBlock(att: {
  id: string;
  title: string;
}) {
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
 */
export async function resolveAttachmentRefs(
  messages: ThreadMessageLike[],
  storage: AttachmentsStorage
): Promise<ThreadMessageLike[]> {
  const ids = collectRefIds(messages);
  if (ids.length === 0) return messages;

  const records = await storage.readManyByIds(ids);
  const map = new Map<string, Attachment>();
  for (let i = 0; i < ids.length; i += 1) {
    const rec = records[i];
    if (rec) map.set(ids[i], rec);
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

function collectRefIds(messages: ThreadMessageLike[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    const content = msg.content;
    if (typeof content === "string" || !Array.isArray(content)) continue;
    for (const part of content) {
      const meta = extractRefFromPart(part);
      if (meta && !seen.has(meta.ref)) {
        seen.add(meta.ref);
        ids.push(meta.ref);
      }
    }
  }
  return ids;
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
    if (!meta) return part;
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
