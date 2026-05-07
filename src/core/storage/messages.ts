import type { ThreadMessageLike } from "@assistant-ui/react";

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
   * Get messages for a thread sorted by timestamp ascending (oldest first),
   * with standard offset/limit pagination.
   *
   * @param threadId - The thread whose messages to retrieve.
   * @param limit - Max messages to return. Omit for no cap.
   * @param startIndex - Zero-based index from the oldest message to start
   *   from. Omit for `0`.
   * @returns An array of messages in chronological order.
   */
  readByThread(
    threadId: string,
    limit?: number,
    startIndex?: number
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
