import type { Thread } from "../types";

/**
 * Storage interface for managing chat threads (conversations).
 *
 * Each thread represents a single chat session with a title, an optional
 * profile binding, and a `lastEditDate` that is bumped whenever the
 * thread is modified. Implementations must persist data across page
 * reloads (e.g. IndexedDB, REST API, etc.).
 */
export interface ThreadsStorage {
  /**
   * Create a new thread and persist it to storage.
   *
   * @param threadId - Unique identifier for the thread.
   * @param title - Human-readable title shown in the sidebar.
   * @param profileId - Optional profile ID that owns this thread.
   */
  create(title: string, profileId?: string): Promise<Thread>;

  /**
   * Find a thread by its ID.
   *
   * @param threadId - The thread identifier to look up.
   * @returns The matching thread, or `null` if not found.
   */
  readById(threadId: string): Promise<Thread | null>;

  /**
   * Retrieve all threads sorted by `lastEditDate` descending (newest first).
   *
   * @returns An array of all persisted threads.
   */
  readAll(): Promise<Thread[]>;

  /**
   * Update a thread's title. The caller is responsible for bumping
   * `lastEditDate` via {@link touch} if it wants the thread to resurface
   * in the sidebar.
   *
   * @param threadId - The thread to update.
   * @param title - The new title, if provided.
   */
  update(threadId: string, title?: string): Promise<void>;

  /**
   * Set the thread's `lastEditDate` to the supplied timestamp and
   * optionally update the bound profile. The caller owns the clock —
   * storage never reads `Date.now()`.
   *
   * @param threadId - The thread to touch.
   * @param lastEditDate - The new `lastEditDate` (ms since epoch).
   * @param updates - Optional fields to set alongside the timestamp.
   */
  touch(
    threadId: string,
    lastEditDate: number,
    updates?: {
      profileId?: string | null;
    }
  ): Promise<void>;

  /**
   * Delete a thread and all its messages (cascading delete).
   *
   * @param threadId - The thread to remove.
   */
  delete(threadId: string): Promise<void>;
}
