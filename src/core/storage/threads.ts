import type { Thread } from "../types";
import type { ThreadsCursor } from "./pagination";

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
   * @param title - Human-readable title shown in the sidebar.
   * @param profileId - Optional profile ID that owns this thread.
   * @param entityId - Optional opaque scope token (entity / "room") the
   *   thread is bound to. When provided, the implementation should
   *   persist it on the record so subsequent {@link readAll} calls with
   *   the same `entityId` return this thread. When omitted, the thread
   *   belongs to the unscoped (passthrough) area.
   */
  create(title: string, profileId?: string, entityId?: string): Promise<Thread>;

  /**
   * Find a thread by its ID.
   *
   * @param threadId - The thread identifier to look up.
   * @returns The matching thread, or `null` if not found.
   */
  readById(threadId: string): Promise<Thread | null>;

  /**
   * Retrieve threads sorted by `lastEditDate` descending (newest first),
   * with `threadId` descending as the tiebreaker, filtered by entity
   * scope. Threads without a `lastEditDate` sort after every dated one.
   *
   * - `entityId === undefined` → return only threads created in the
   *   unscoped (passthrough) area, i.e. without an entity binding.
   * - `entityId === "<id>"` → return only threads bound to that entity.
   *
   * Cursor pagination (both parameters optional — omitting them returns
   * the full list, the pre-pagination behavior):
   *
   * - `count` — max threads to return.
   * - `cursor` — sort key of the last thread the caller already has;
   *   return threads strictly AFTER it in the sort order above.
   *   `lastEditDate: null` in the cursor means the anchor thread had no
   *   timestamp.
   *
   * Implementations that don't support pagination may ignore both
   * parameters and return everything — callers detect that and stop
   * paging.
   *
   * @param entityId - Optional opaque scope token (entity / "room").
   * @param count - Optional page size.
   * @param cursor - Optional keyset cursor of the last received thread.
   * @returns An array of persisted threads in scope.
   */
  readAll(
    entityId?: string,
    count?: number,
    cursor?: ThreadsCursor
  ): Promise<Thread[]>;

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
