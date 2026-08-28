import type { ThreadMessageLike } from "@assistant-ui/react";
import type { MessagesCursor, MessagesDirection } from "./pagination";

/**
 * Storage interface for managing individual chat messages within threads.
 *
 * Messages are stored with a timestamp and are always scoped to a parent
 * thread. Implementations must support full-text search across all
 * message content.
 */
export interface MessagesStorage {
  /**
   * Save a new message in a thread. Storage assigns the message id and
   * `createdAt` timestamp; callers provide only the message body.
   *
   * @param threadId - The parent thread ID.
   * @param message - The message content (without `id` / `createdAt`).
   * @returns The persisted message with `id` and `createdAt` populated.
   */
  create(
    threadId: string,
    message: Omit<ThreadMessageLike, "id" | "createdAt">
  ): Promise<ThreadMessageLike>;

  /**
   * Find a specific message by ID. Message IDs are globally unique, so
   * no thread scoping is required.
   *
   * @param messageId - The message identifier to look up.
   * @returns The matching message, or `null` if not found.
   */
  readById(messageId: string): Promise<ThreadMessageLike | null>;

  /**
   * Get messages for a thread ordered by `createdAt`, with `id` as the
   * tiebreaker — ascending (oldest first) by default, descending when
   * `direction` says so.
   *
   * Cursor pagination (every parameter optional — omitting them returns
   * the full thread, the pre-pagination behavior):
   *
   * - `count` — max messages to return.
   * - `cursor` — sort key of the last message the caller already has
   *   (`createdAt` as an ISO string); return messages strictly AFTER it
   *   in the direction being walked.
   * - `direction` — `"asc"` (default) reads forward from the oldest
   *   message; `"desc"` reads backwards from the newest. A chat view
   *   opens on the tail with a `"desc"` page and keeps pulling older
   *   pages as the user scrolls up; a full-history reader (the request
   *   history of a round, export) walks `"asc"` as before.
   *
   * Implementations that don't support pagination may ignore all three
   * parameters and return everything — callers detect that and stop
   * paging. Ignoring only `direction` is equally safe: the caller sees
   * an ascending page where it asked for a descending one and falls back
   * to a forward read.
   *
   * @param threadId - The thread whose messages to retrieve.
   * @param count - Optional page size.
   * @param cursor - Optional keyset cursor of the last received message.
   * @param direction - Optional read direction, `"asc"` by default.
   * @returns An array of messages in the order they were read.
   */
  readByThread(
    threadId: string,
    count?: number,
    cursor?: MessagesCursor,
    direction?: MessagesDirection
  ): Promise<ThreadMessageLike[]>;

  /**
   * Update message content (e.g. after receiving a tool result).
   * Also updates the timestamp.
   *
   * @param messageId - The message to update.
   * @param message - The replacement message content.
   */
  update(messageId: string, message: ThreadMessageLike): Promise<void>;

  /**
   * Delete a single message by ID. Implementations must cascade-delete
   * any attachments owned by the message via
   * `attachments.deleteByMessage(messageId)`.
   *
   * @param messageId - The message to remove.
   */
  delete(messageId: string): Promise<void>;

  /**
   * Delete all messages in a thread. Used for clearing history or as
   * part of a cascading thread delete. Implementations must cascade-
   * delete any attachments owned by the thread via
   * `attachments.deleteByThread(threadId)`.
   *
   * @param threadId - The thread whose messages should be removed.
   */
  deleteByThread(threadId: string): Promise<void>;
}
