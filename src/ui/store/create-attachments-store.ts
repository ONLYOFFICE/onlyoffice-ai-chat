import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { TAttachmentRef } from "../../types";
import type { AttachmentsApi } from "../providers/ApiProvider/attachments";

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
 *
 * While a payload is still being produced (portal upload, text
 * conversion, the storage call itself) the draft shows a loading chip
 * backed by {@link TPendingAttachment} — see
 * {@link AttachmentsStoreState.beginPendingAttachments} for the lease
 * model that ties placeholders to the 5-item cap.
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

/**
 * A placeholder for an attachment whose payload is still being produced —
 * a host portal upload in flight, a `convertFileToText` round trip, a
 * `FileReader` read, or the `saveFilesMany` storage call itself. It exists
 * purely so the composer can render a loading chip the instant the user
 * picks a file, and is swapped for the real {@link TAttachmentRef}
 * atomically once the payload lands.
 *
 * The id is **client-generated** (`pnd-…`) and never collides with the
 * storage-assigned ids on real refs, so React keys stay stable across the
 * swap and a stale placeholder can always be told apart from a ref.
 */
export type TPendingAttachment = {
  /** Client-generated id, `pnd-…`. Also the React key. */
  id: string;
  /** Display label — the picked file's name, extension included. */
  title: string;
  /**
   * Which list the settled ref will land in, i.e. which cap bucket this
   * placeholder occupies. Host device uploads reserve `"file"` even for
   * images, because they settle through `addAttachmentFile` and are
   * re-keyed to images only afterwards — do not "fix" that to `"image"`,
   * it would double-book the image bucket.
   */
  kind: "file" | "image";
  /** ONLYOFFICE file type code for the chip icon; omitted → generic. */
  type?: number;
};

/** Reservation payload for {@link AttachmentsStoreState.beginPendingAttachments}. */
export type PendingAttachmentInput = Omit<TPendingAttachment, "id">;

/** Options bag shared by `addAttachmentFile` / `addAttachmentImage`. */
export interface AddAttachmentOptions {
  /**
   * Loading-chip leases from
   * {@link AttachmentsStoreState.beginPendingAttachments}, one per input in
   * the same order. Passing them makes the swap placeholder → real chip
   * atomic and stops the reservation being counted twice against the
   * 5-item cap. Without it the call reserves its own placeholders, so any
   * caller gets the loading state for the storage round trip for free.
   */
  pendingIds?: string[];
}

export interface AttachmentsStoreState {
  /** File refs currently attached to the draft (max 5). */
  attachmentFiles: TAttachmentRef[];
  /** Image refs currently attached to the draft (max 5). */
  attachmentImages: TAttachmentRef[];
  /**
   * Placeholders for attachments still being produced, in reservation
   * order. Rendered by the composer as loading chips after the real ones.
   * Each counts toward the 5-item cap of its `kind` bucket, so a pending
   * file cannot let a 6th file through.
   */
  pendingAttachments: TPendingAttachment[];
  /**
   * Transient `id → base64` cache for in-session image previews.
   * Read via {@link selectImageBase64}; never serialized.
   */
  _imageCache: Record<string, string>;

  /**
   * Reserve loading chips **synchronously** — call this the moment the
   * user picks or drops, before any await, so the chips paint on the same
   * frame. Truncates to the free slots of each `kind` bucket
   * (`ATTACHMENT_LIMIT` minus the real refs minus the placeholders already
   * standing) and returns the ids it accepted, in input order:
   * `ids.length < inputs.length` means the tail was refused for lack of
   * room and the caller should not bother producing those payloads.
   *
   * Every returned id is a **lease** on a cap slot. Hand the ids back to
   * {@link addAttachmentFile} / {@link addAttachmentImage} via
   * `options.pendingIds` so the slot is not counted twice and the swap
   * placeholder → ref happens in a single `set`. A lease that is gone by
   * the time the payload lands (user hit the close button, thread
   * switched) makes the settle a no-op and the storage record is deleted.
   *
   * Deliberately not queued on the mutex: it is pure synchronous state,
   * and waiting behind an in-flight upload would defeat its whole point.
   */
  beginPendingAttachments: (inputs: PendingAttachmentInput[]) => string[];

  /**
   * Drop placeholders whose production failed. Ids that are already gone
   * are ignored, so callers can fail a whole batch defensively. Does not
   * toast — error reporting stays with the caller that owns the context.
   */
  failPendingAttachments: (ids: string[]) => void;

  /**
   * User dismissed a loading chip. Drops the placeholder and, because the
   * lease is now gone, makes the eventual settle discard the ref and its
   * storage record. The underlying production is *not* aborted — a portal
   * upload finishes and the file stays in the user's folder; only the
   * attachment is dropped.
   */
  cancelPendingAttachment: (id: string) => void;

  /**
   * Persist a file payload to storage and append the resulting ref.
   * Accepts a single input or an array — the batch form runs `saveFile`
   * in parallel via `Promise.all` and applies the 5-item limit atomically
   * (items past the cap are silently dropped). No-op when the cap is
   * already reached. Calls are serialized internally so concurrent
   * invocations cannot race past the limit check.
   *
   * Loading chips: see {@link AddAttachmentOptions.pendingIds}. Without
   * them the call reserves its own placeholders up front; with them it
   * consumes exactly those leases. Inputs whose lease vanished mid-flight
   * are dropped and their storage records deleted.
   */
  addAttachmentFile: (
    input: FileAttachmentInput | FileAttachmentInput[],
    options?: AddAttachmentOptions
  ) => Promise<void>;

  /** Remove a file ref by id and delete the underlying storage record. */
  deleteAttachmentFile: (id: string) => Promise<void>;

  /**
   * Remove all file refs (and their storage records). Also revokes the
   * leases of pending *file* chips — a thread switch mid-upload must not
   * land a chip in the newly opened draft.
   */
  clearAttachmentFiles: () => Promise<void>;

  /**
   * Persist an image payload to storage and append the resulting ref.
   * Accepts a single input or an array — the batch form runs `saveImage`
   * in parallel and applies the 5-item limit atomically (extras dropped).
   * The base64 also lands in `_imageCache` so the composer thumbnail
   * appears without a follow-up storage round trip. Serialized like
   * {@link addAttachmentFile}, and takes the same loading-chip options.
   */
  addAttachmentImage: (
    input: ImageAttachmentInput | ImageAttachmentInput[],
    options?: AddAttachmentOptions
  ) => Promise<void>;

  /** Remove an image ref by id, drop its cached base64, and delete storage. */
  deleteAttachmentImage: (id: string) => Promise<void>;

  /**
   * Remove all image refs (and their storage records, and cache entries).
   * Also revokes the leases of pending *image* chips.
   */
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

// Client-side placeholder id. `crypto.randomUUID` is unavailable in
// non-secure contexts (some desktop-editor webviews), hence the fallback.
// The `pnd-` namespace guarantees no collision with storage-assigned ids.
const makePendingId = (): string =>
  `pnd-${
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;

// Display label for a self-reserved file placeholder when the input has no
// explicit title — mirrors how storage derives titles from paths.
const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path;

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

  return create<AttachmentsStoreState>((set, get) => {
    // Split leases into the ones still standing and the ones revoked while
    // the caller was awaiting — the paired `items` array must stay aligned
    // with the leases, so both are filtered in the same pass.
    const partitionByLease = <T>(
      items: T[],
      leases: string[]
    ): { live: T[]; liveLeases: string[] } => {
      const alive = new Set(get().pendingAttachments.map((p) => p.id));
      const live: T[] = [];
      const liveLeases: string[] = [];
      items.forEach((item, i) => {
        if (alive.has(leases[i])) {
          live.push(item);
          liveLeases.push(leases[i]);
        }
      });
      return { live, liveLeases };
    };

    return {
      attachmentFiles: [],
      attachmentImages: [],
      pendingAttachments: [],
      _imageCache: {},

      beginPendingAttachments: (inputs) => {
        // One synchronous pass: capacity is derived per bucket from the
        // real refs plus the placeholders already standing, and each
        // accepted input immediately consumes a slot for the next one.
        // `continue` rather than `break`: a mixed batch whose image bucket
        // is full still admits its files — which is why callers pairing
        // ids with inputs positionally must reserve per bucket.
        const s = get();
        const used: Record<TPendingAttachment["kind"], number> = {
          file: s.attachmentFiles.length,
          image: s.attachmentImages.length,
        };
        for (const p of s.pendingAttachments) used[p.kind] += 1;

        const accepted: TPendingAttachment[] = [];
        for (const input of inputs) {
          if (used[input.kind] >= ATTACHMENT_LIMIT) continue;
          used[input.kind] += 1;
          accepted.push({ ...input, id: makePendingId() });
        }
        if (accepted.length === 0) return [];
        set((prev) => ({
          pendingAttachments: [...prev.pendingAttachments, ...accepted],
        }));
        return accepted.map((p) => p.id);
      },

      failPendingAttachments: (ids) => {
        if (ids.length === 0) return;
        const drop = new Set(ids);
        set((s) => ({
          pendingAttachments: s.pendingAttachments.filter(
            (p) => !drop.has(p.id)
          ),
        }));
      },

      cancelPendingAttachment: (id) => {
        // Same mechanics as fail — the lease disappearing is what makes
        // the in-flight settle discard its ref.
        set((s) => ({
          pendingAttachments: s.pendingAttachments.filter((p) => p.id !== id),
        }));
      },

      addAttachmentFile: (input, options) => {
        const all = Array.isArray(input) ? input : [input];
        // Reserve *outside* the mutex so the chips appear now, not after
        // the upload currently holding the queue finishes. Callers that
        // already reserved (host uploads, library pick paths) hand their
        // ids in instead. The leases *are* the cap check: reservation
        // refused the tail past the limit, so no `remaining` arithmetic
        // is needed in the queued body — that is what makes counting a
        // slot twice impossible.
        const leases =
          options?.pendingIds ??
          get().beginPendingAttachments(
            all.map((i) => ({
              title: i.title ?? basename(i.path),
              kind: "file" as const,
              type: i.type,
            }))
          );
        const inputs = all.slice(0, leases.length);
        if (inputs.length === 0) return Promise.resolve();

        return queue(async () => {
          // Leases may have been revoked while this call sat in the queue.
          const { live, liveLeases } = partitionByLease(inputs, leases);
          if (live.length === 0) return;

          // Single batch call — lands on the backend as one HTTP POST
          // regardless of how many files the user dropped. Storage owns
          // id/createdAt; we just stash the lightweight refs.
          const records = await attachments.saveFilesMany(live, entity());

          // Re-check leases after the round trip: a close-button press or
          // a thread switch during the upload revokes them, and the refs
          // must not leak into a draft that no longer wants them.
          const still = new Set(get().pendingAttachments.map((p) => p.id));
          const keep: TAttachmentRef[] = [];
          const orphans: string[] = [];
          records.forEach((record, i) => {
            if (!still.has(liveLeases[i])) {
              orphans.push(record.id);
              return;
            }
            keep.push({
              id: record.id,
              title: record.title,
              kind: "file",
              path: record.path,
              type: record.type,
            });
          });

          // One `set`: placeholders out, refs in — never a frame with
          // both (duplicate chip) or neither (chip blink).
          const consumed = new Set(leases);
          set((s) => ({
            attachmentFiles: [...s.attachmentFiles, ...keep],
            pendingAttachments: s.pendingAttachments.filter(
              (p) => !consumed.has(p.id)
            ),
          }));

          if (orphans.length > 0) {
            await attachments.deleteMany(orphans).catch(() => undefined);
          }
        }).catch((err) => {
          // The queued body threw (storage failure) — the placeholders
          // must not outlive it. Re-throw so callers keep owning the toast.
          get().failPendingAttachments(leases);
          throw err;
        });
      },

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
        // Revoke file leases too: a thread switch mid-upload must not have
        // the settle land a chip in the newly opened draft.
        set((s) => ({
          attachmentFiles: [],
          pendingAttachments: s.pendingAttachments.filter(
            (p) => p.kind !== "file"
          ),
        }));
        if (ids.length > 0) {
          // Best-effort — if some deletes fail the orphans get caught by
          // the future GC pass. Don't crash the UI on a network blip.
          await attachments.deleteMany(ids).catch(() => undefined);
        }
      },

      addAttachmentImage: (input, options) => {
        const all = Array.isArray(input) ? input : [input];
        // Same lease flow as addAttachmentFile — see the comments there.
        const leases =
          options?.pendingIds ??
          get().beginPendingAttachments(
            all.map((i) => ({
              title: i.title ?? i.name,
              kind: "image" as const,
            }))
          );
        const inputs = all.slice(0, leases.length);
        if (inputs.length === 0) return Promise.resolve();

        return queue(async () => {
          const { live, liveLeases } = partitionByLease(inputs, leases);
          if (live.length === 0) return;

          // One batch call — see addAttachmentFile for rationale.
          const records = await attachments.saveImagesMany(live, entity());

          const still = new Set(get().pendingAttachments.map((p) => p.id));
          const keep: TAttachmentRef[] = [];
          const orphans: string[] = [];
          const cacheAdditions: Record<string, string> = {};
          records.forEach((record, i) => {
            if (!still.has(liveLeases[i])) {
              orphans.push(record.id);
              return;
            }
            keep.push({
              id: record.id,
              title: record.title,
              kind: "image",
            });
            cacheAdditions[record.id] = live[i].base64;
          });

          const consumed = new Set(leases);
          set((s) => ({
            attachmentImages: [...s.attachmentImages, ...keep],
            pendingAttachments: s.pendingAttachments.filter(
              (p) => !consumed.has(p.id)
            ),
            _imageCache: { ...s._imageCache, ...cacheAdditions },
          }));

          if (orphans.length > 0) {
            await attachments.deleteMany(orphans).catch(() => undefined);
          }
        }).catch((err) => {
          get().failPendingAttachments(leases);
          throw err;
        });
      },

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
        set((s) => ({
          attachmentImages: [],
          pendingAttachments: s.pendingAttachments.filter(
            (p) => p.kind !== "image"
          ),
          _imageCache: {},
        }));
        if (ids.length > 0) {
          await attachments.deleteMany(ids).catch(() => undefined);
        }
      },
    };
  });
}
