/**
 * Persistent record for a single attachment (file or image) referenced
 * from a user message. Files carry extracted text in `content`; images
 * carry base64 data in `base64`. Metadata (`title`, `path`, `type`) is
 * always present for display purposes regardless of whether the heavy
 * payload is loaded.
 */
export interface Attachment {
  /** Storage-assigned UUID. */
  id: string;

  /** "file" | "image". */
  kind: "file" | "image";

  /**
   * Origin of the attachment. `"user"` — uploaded by the user in the
   * composer (the default when unset, for backward compatibility).
   * `"tool"` — produced by a tool call (e.g. `generate_image`). Lets the
   * integrator's adapter route or apply policies (separate bucket,
   * quotas, TTL, CDN) per source.
   */
  source?: "user" | "tool";

  /** Display label (filename or user-visible title). */
  title: string;

  /** Extracted text for files. */
  content?: string;

  /** Base64 data URL for images. */
  base64?: string;

  /** Original host file path (for files). */
  path?: string;

  /** ONLYOFFICE file type code (for files). */
  type?: number;

  /** Owning message id once linked. Unset while the attachment is a draft. */
  messageId?: string;

  /** Owning thread id once linked. Unset while the attachment is a draft. */
  threadId?: string;

  /**
   * Opaque scope token (entity / "room") the attachment was created in.
   * Drafts carry it so an entity switch keeps in-flight composer state
   * isolated; once linked to a message the field is redundant with the
   * thread's own entity binding.
   */
  entityId?: string;

  /** Storage-assigned creation timestamp. */
  createdAt: number;

  /** Whether the attached form can be analyzed. */
  canAnalyze?: boolean;

  /**
   * Keys of the fields inside the form. `key` is the field identifier,
   * `text` its human-readable label.
   */
  formKeys?: { key: string; text: string }[];
}

/**
 * Storage interface for user-message attachments.
 *
 * Drafts are written eagerly when the user attaches a file/image in the
 * composer (so the UI keeps only a small ref `{id, title, …}` in memory)
 * and are bound to a message via {@link update} / message-id patch once
 * the user message is persisted. Cascade deletes on message and thread
 * removal keep the store in step with `messages` and `threads`.
 */
export interface AttachmentsStorage {
  /**
   * Persist a new attachment. Storage assigns the `id` and `createdAt`
   * timestamp; callers provide only the payload + metadata.
   *
   * @param input - Attachment without `id` / `createdAt`.
   * @returns The stored record with `id` / `createdAt` populated.
   */
  create(input: Omit<Attachment, "id" | "createdAt">): Promise<Attachment>;

  /**
   * Persist a batch of attachments in a single round trip. Mirrors
   * {@link create}: storage assigns each record's `id` / `createdAt`.
   * Implementations should write the whole batch atomically when
   * possible (one IndexedDB transaction, one POST on a remote backend)
   * — issuing N independent `create` calls would defeat the optimization
   * the composer relies on when the user drops multiple files at once.
   *
   * Order of the returned array matches the input.
   */
  createMany(
    inputs: Omit<Attachment, "id" | "createdAt">[]
  ): Promise<Attachment[]>;

  /**
   * Fetch a single attachment by id.
   *
   * @returns The matching record, or `null` if not found.
   */
  readById(id: string): Promise<Attachment | null>;

  /**
   * Batch fetch multiple attachments by id. Used by the resolver to
   * hydrate refs from a full message-history scan in a single round
   * trip. Implementations may return records in any order and omit
   * missing ids entirely — the resolver matches by `rec.id`, not by
   * position.
   */
  readManyByIds(ids: string[]): Promise<(Attachment | null)[]>;

  /**
   * Patch an existing attachment record. Typically used to bind a
   * draft (`messageId`/`threadId` unset) to its owning message after
   * the user message has been persisted.
   */
  update(id: string, patch: Partial<Attachment>): Promise<void>;

  /**
   * Patch a batch of attachments with the same `patch` in one round
   * trip. Used by `AttachmentsEngine.linkToMessage` to bind every draft
   * in a multi-attachment message to its owning message+thread at once.
   * Implementations should commit the batch atomically (one IndexedDB
   * transaction, one PATCH on a remote backend); missing ids are
   * silently skipped. The `id` / `createdAt` fields on each record
   * cannot be patched — implementations must preserve them.
   */
  updateManyByIds(ids: string[], patch: Partial<Attachment>): Promise<void>;

  /** Delete a single attachment by id. */
  delete(id: string): Promise<void>;

  /**
   * Delete a batch of attachments by id in one round trip. The default
   * pattern in the UI for clearing a draft list — issuing N separate
   * `delete` calls would mean N HTTP requests on a remote backend.
   * Implementations should handle missing ids silently.
   */
  deleteMany(ids: string[]): Promise<void>;

  /**
   * Delete all attachments owned by a message. Called by the messages
   * storage on `delete()` to keep the cascade tight.
   */
  deleteByMessage(messageId: string): Promise<void>;

  /**
   * Delete all attachments owned by a thread. Called by the messages
   * storage on `deleteByThread()` (which itself cascades from
   * `threads.delete()`).
   */
  deleteByThread(threadId: string): Promise<void>;
}
