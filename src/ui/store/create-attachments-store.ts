import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { TAttachmentRef } from "../../types";
import type { AttachmentsApi } from "../providers/ApiProvider/attachments";
import type { Attachment } from "../../core";

/**
 * Zustand state for file and image attachment refs on the current
 * message draft.
 *
 * Each add operation persists the full payload through `api.attachments`
 * (in-process or remote depending on `ServerAPIConfig`) and keeps only
 * the lightweight {@link TAttachmentRef} (`{id, title, kind, ...}`) in
 * memory. Delete and clear operations cascade the storage delete so the
 * draft never leaves orphan records when the user backs out of an
 * attachment they just added.
 *
 * Image base64 payloads are kept in a transient cache (`_imageCache`)
 * keyed by id so the composer thumbnail and the just-sent message
 * bubble can render without round-tripping through `api.attachments.get`.
 * The cache is dropped on explicit delete / clear, but **survives** the
 * `setState` we use during `onNew` send-flow so the bubble that just
 * appeared can still read it. Switching threads runs `clearAttachment*`
 * which drops the cache.
 */
export interface FileAttachmentInput {
  path: string;
  content: string;
  type: number;
  title?: string;
}

export interface ImageAttachmentInput {
  name: string;
  base64: string;
  title?: string;
}

export interface AttachmentsStoreState {
  /** File refs currently attached to the draft (max 5). */
  attachmentFiles: TAttachmentRef[];
  /** Image refs currently attached to the draft (max 5). */
  attachmentImages: TAttachmentRef[];
  /**
   * Transient `id → base64` cache for in-session image previews.
   * Read via {@link selectImageBase64}; never serialized.
   */
  _imageCache: Record<string, string>;

  /**
   * Persist a file payload to storage and append the resulting ref.
   * Accepts a single input or an array — the batch form runs `saveFile`
   * in parallel via `Promise.all` and applies the 5-item limit atomically
   * (items past the cap are silently dropped). No-op when the cap is
   * already reached. Calls are serialized internally so concurrent
   * invocations cannot race past the limit check.
   */
  addAttachmentFile: (
    input: FileAttachmentInput | FileAttachmentInput[]
  ) => Promise<Attachment[] | undefined>;

  /** Remove a file ref by id and delete the underlying storage record. */
  deleteAttachmentFile: (id: string) => Promise<void>;

  /** Remove all file refs (and their storage records). */
  clearAttachmentFiles: () => Promise<void>;

  /**
   * Persist an image payload to storage and append the resulting ref.
   * Accepts a single input or an array — the batch form runs `saveImage`
   * in parallel and applies the 5-item limit atomically (extras dropped).
   * The base64 also lands in `_imageCache` so the composer thumbnail
   * appears without a follow-up storage round trip. Serialized like
   * {@link addAttachmentFile}.
   */
  addAttachmentImage: (
    input: ImageAttachmentInput | ImageAttachmentInput[]
  ) => Promise<void>;

  /** Remove an image ref by id, drop its cached base64, and delete storage. */
  deleteAttachmentImage: (id: string) => Promise<void>;

  /** Remove all image refs (and their storage records, and cache entries). */
  clearAttachmentImages: () => Promise<void>;
}

export interface CreateAttachmentsStoreConfig {
  /**
   * `api.attachments` slice — routes every call in-process or over
   * HTTP depending on `ServerAPIConfig`.
   */
  attachments: AttachmentsApi;
  /**
   * Entity scope forwarded to `attachments.saveFile / saveImage` so
   * drafts created in one entity stay isolated from another entity's
   * drafts. Mirrors the `entityId` plumbing on threads / assignments /
   * web-search.
   */
  getEntityId?: () => string | undefined;
}

const ATTACHMENT_LIMIT = 5;

/**
 * Selector helper — read a cached base64 for a given attachment id.
 * Returns `undefined` if the entry was never seen (history reload, or
 * dropped by an earlier clear).
 */
export const selectImageBase64 =
  (id: string | undefined) =>
  (s: AttachmentsStoreState): string | undefined =>
    id ? s._imageCache[id] : undefined;

export function createAttachmentsStore(
  config: CreateAttachmentsStoreConfig
): UseBoundStore<StoreApi<AttachmentsStoreState>> {
  const { attachments, getEntityId } = config;
  const entity = () => getEntityId?.();

  // Per-store mutex — every `add*` call queues onto this chain so
  // limit-check + storage-write + state-update cannot interleave with
  // a parallel `add*` call. Without this, picking 6 files at once can
  // bypass the 5-item cap because all 6 invocations read `length === 0`
  // before any of them commits.
  let chain: Promise<unknown> = Promise.resolve();
  const queue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };

  return create<AttachmentsStoreState>((set, get) => ({
    attachmentFiles: [],
    attachmentImages: [],
    _imageCache: {},

    addAttachmentFile: (input) =>
      queue(async () => {
        const remaining = ATTACHMENT_LIMIT - get().attachmentFiles.length;
        if (remaining <= 0) return;
        const inputs = (Array.isArray(input) ? input : [input]).slice(
          0,
          remaining
        );
        if (inputs.length === 0) return;
        // Single batch call — lands on the backend as one HTTP POST
        // regardless of how many files the user dropped. Storage owns
        // id/createdAt; we just stash the lightweight refs.
        const records = await attachments.saveFilesMany(inputs, entity());
        const refs: TAttachmentRef[] = records.map((record) => ({
          id: record.id,
          title: record.title,
          kind: "file",
          path: record.path,
          type: record.type,
        }));

        set((s) => ({ attachmentFiles: [...s.attachmentFiles, ...refs] }));

        return records;
      }),

    deleteAttachmentFile: async (id) => {
      // Await storage first — if the remote delete fails we surface it
      // and keep the ref visible so the user can retry. No silent split
      // between UI and persistence.
      await attachments.delete(id);
      set((s) => ({
        attachmentFiles: s.attachmentFiles.filter((f) => f.id !== id),
      }));
    },

    clearAttachmentFiles: async () => {
      const ids = get().attachmentFiles.map((f) => f.id);
      set({ attachmentFiles: [] });
      if (ids.length > 0) {
        // Best-effort — if some deletes fail the orphans get caught by
        // the future GC pass. Don't crash the UI on a network blip.
        await attachments.deleteMany(ids).catch(() => undefined);
      }
    },

    addAttachmentImage: (input) =>
      queue(async () => {
        const remaining = ATTACHMENT_LIMIT - get().attachmentImages.length;
        if (remaining <= 0) return;
        const inputs = (Array.isArray(input) ? input : [input]).slice(
          0,
          remaining
        );
        if (inputs.length === 0) return;
        // One batch call — see addAttachmentFile for rationale.
        const records = await attachments.saveImagesMany(inputs, entity());
        const refs: TAttachmentRef[] = records.map((record) => ({
          id: record.id,
          title: record.title,
          kind: "image",
        }));
        const cacheAdditions: Record<string, string> = {};
        records.forEach((record, i) => {
          cacheAdditions[record.id] = inputs[i].base64;
        });
        set((s) => ({
          attachmentImages: [...s.attachmentImages, ...refs],
          _imageCache: { ...s._imageCache, ...cacheAdditions },
        }));
      }),

    deleteAttachmentImage: async (id) => {
      await attachments.delete(id);
      set((s) => {
        const cache = { ...s._imageCache };
        delete cache[id];
        return {
          attachmentImages: s.attachmentImages.filter((i) => i.id !== id),
          _imageCache: cache,
        };
      });
    },

    clearAttachmentImages: async () => {
      const ids = get().attachmentImages.map((i) => i.id);
      set({ attachmentImages: [], _imageCache: {} });
      if (ids.length > 0) {
        await attachments.deleteMany(ids).catch(() => undefined);
      }
    },
  }));
}
