import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Thread } from "../types";

/** Page size used by every paginated read in the library. */
export const PAGE_SIZE = 100;

/**
 * Keyset cursor for {@link ThreadsStorage.readAll}: the sort key of the
 * last thread the caller has already received. The next page contains
 * threads strictly AFTER it in `lastEditDate` DESC, `threadId` DESC
 * order. `lastEditDate` is `null` for threads that never got a
 * timestamp — those sort after every dated thread.
 *
 * `id` mirrors `threadId` — it lets a backend whose keyset tiebreak
 * column is literally named `id` read the cursor field directly. The
 * widget always sets it equal to `threadId`, so implementations may key
 * off either.
 */
export type ThreadsCursor = {
  lastEditDate: number | null;
  threadId: string;
  id: string;
};

/**
 * Keyset cursor for {@link MessagesStorage.readByThread}: the sort key
 * of the last message the caller has already received. The next page
 * contains messages strictly AFTER it in `createdAt` ASC, `id` ASC
 * order. `createdAt` is serialized as an ISO string so the cursor
 * survives a JSON round trip through a query parameter.
 */
export type MessagesCursor = {
  createdAt: string | null;
  id: string;
};

/** Build the {@link ThreadsCursor} pointing at the given thread. */
export function threadsCursorOf(thread: Thread): ThreadsCursor {
  return {
    lastEditDate: thread.lastEditDate ?? null,
    threadId: thread.threadId,
    id: thread.threadId,
  };
}

/** Build the {@link MessagesCursor} pointing at the given message. */
export function messagesCursorOf(message: ThreadMessageLike): MessagesCursor {
  const createdAt = message.createdAt;
  return {
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : typeof createdAt === "string"
          ? createdAt
          : null,
    id: message.id ?? "",
  };
}

/**
 * Hard ceiling on pages fetched by {@link drainPages} — a runaway-loop
 * backstop far above any real collection (1000 pages × 100 items).
 */
const MAX_PAGES = 1000;

/**
 * Fetch a whole collection through a cursor-paginated read, page by
 * page. The visible result is identical to an unbounded read; only the
 * size of each individual request is capped.
 *
 * Termination handles adapters at every level of pagination support:
 * - a page shorter than `count` — the collection is exhausted;
 * - a page LONGER than `count` — a legacy adapter ignored the params
 *   and returned everything in one go;
 * - a page that contributes no new ids — an adapter that ignores the
 *   cursor and keeps returning the same slice (never loop forever);
 * - the {@link MAX_PAGES} backstop.
 *
 * Items are de-duplicated by id across pages: inserts/deletes between
 * requests may shift the window, and the same record must not appear
 * twice in the result.
 */
export async function drainPages<T, C>(
  fetchPage: (count: number, cursor?: C) => Promise<T[]>,
  cursorOf: (item: T) => C,
  idOf: (item: T) => string,
  count = PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let cursor: C | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const items = await fetchPage(count, cursor);
    let added = 0;
    for (const item of items) {
      const id = idOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
      added++;
    }
    // Exhausted, legacy full dump, or a cursor-ignoring adapter — stop.
    if (items.length !== count || added === 0) break;
    // Advance from the last item the BACKEND returned — not from the
    // deduped accumulator, whose tail may be an earlier record when the
    // page overlapped already-seen items (window shift), which would
    // re-fetch the same window instead of moving forward.
    cursor = cursorOf(items[items.length - 1]);
  }

  return out;
}

/**
 * Resolve a `boolean | (() => boolean)` pagination flag — the same
 * lazy-or-static idiom engine deps use for `forceProxy`.
 */
export function isPaginationEnabled(
  flag: boolean | (() => boolean) | undefined
): boolean {
  return typeof flag === "function" ? flag() : (flag ?? false);
}
