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
   * Fetch a single attachment by id.
   *
   * @returns The matching record, or `null` if not found.
   */
  readById(id: string): Promise<Attachment | null>;

  /**
   * Batch fetch multiple attachments by id. Used by the resolver to
   * hydrate refs from a full message-history scan in a single round
   * trip. The result preserves caller order; missing ids are returned
   * as `null` in their slot.
   */
  readManyByIds(ids: string[]): Promise<(Attachment | null)[]>;

  /**
   * Patch an existing attachment record. Typically used to bind a
   * draft (`messageId`/`threadId` unset) to its owning message after
   * the user message has been persisted.
   */
  update(id: string, patch: Partial<Attachment>): Promise<void>;

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
