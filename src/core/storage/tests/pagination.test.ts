import { describe, expect, it, vi } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Thread } from "../../types";
import { drainPages, messagesCursorOf, threadsCursorOf } from "../pagination";

type Item = { id: string };

const item = (id: number): Item => ({ id: String(id) });
const items = (from: number, n: number): Item[] =>
  Array.from({ length: n }, (_, i) => item(from + i));

const idOf = (x: Item) => x.id;
const cursorOf = (x: Item) => x.id;

describe("drainPages", () => {
  it("walks full pages until a short page and concatenates in order", async () => {
    const pages = [items(0, 100), items(100, 100), items(200, 50)];
    let call = 0;
    const fetchPage = vi.fn(async (_count: number, cursor?: string) => {
      // The cursor must point at the last item of the previous page.
      if (call > 0) {
        expect(cursor).toBe(String(call * 100 - 1));
      } else {
        expect(cursor).toBeUndefined();
      }
      return pages[call++] ?? [];
    });

    const out = await drainPages(fetchPage, cursorOf, idOf, 100);
    expect(out).toHaveLength(250);
    expect(out[0].id).toBe("0");
    expect(out[249].id).toBe("249");
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("stops after a single call when the first page is short", async () => {
    const fetchPage = vi.fn(async () => items(0, 7));
    const out = await drainPages(fetchPage, cursorOf, idOf, 100);
    expect(out).toHaveLength(7);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("stops when a legacy adapter ignores count and returns everything", async () => {
    const fetchPage = vi.fn(async () => items(0, 350));
    const out = await drainPages(fetchPage, cursorOf, idOf, 100);
    expect(out).toHaveLength(350);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("never loops when an adapter ignores the cursor (same full page back)", async () => {
    const fetchPage = vi.fn(async () => items(0, 100));
    const out = await drainPages(fetchPage, cursorOf, idOf, 100);
    // Second call returns the same 100 ids → zero new items → stop.
    expect(out).toHaveLength(100);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("dedups items that reappear after a window shift between pages", async () => {
    const pages = [
      items(0, 100),
      // An insert on the server shifted the window: item 99 comes again.
      [item(99), ...items(100, 99)],
      [],
    ];
    let call = 0;
    const fetchPage = vi.fn(async () => pages[call++] ?? []);
    const out = await drainPages(fetchPage, cursorOf, idOf, 100);
    expect(out).toHaveLength(199);
    expect(new Set(out.map(idOf)).size).toBe(199);
  });

  it("returns an empty list for an empty collection", async () => {
    const fetchPage = vi.fn(async () => []);
    const out = await drainPages(fetchPage, cursorOf, idOf, 100);
    expect(out).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("advances the cursor from the raw page tail even when it is a duplicate", async () => {
    const cursors: (string | undefined)[] = [];
    const pages = [
      [item(0), item(1), item(2)],
      // Window shifted: the page ends on already-seen item 2.
      [item(3), item(4), item(2)],
      [],
    ];
    let call = 0;
    const fetchPage = vi.fn(async (_count: number, cursor?: string) => {
      cursors.push(cursor);
      return pages[call++] ?? [];
    });
    const out = await drainPages(fetchPage, cursorOf, idOf, 3);
    // The third request must continue AFTER the backend's own tail ("2"),
    // not after the deduped accumulator's tail ("4") — otherwise the
    // window would be re-fetched instead of moving forward.
    expect(cursors).toEqual([undefined, "2", "2"]);
    expect(out.map(idOf)).toEqual(["0", "1", "2", "3", "4"]);
  });
});

describe("cursor builders", () => {
  it("threadsCursorOf carries lastEditDate and threadId", () => {
    const thread: Thread = { threadId: "t1", lastEditDate: 1234 };
    expect(threadsCursorOf(thread)).toEqual({
      lastEditDate: 1234,
      threadId: "t1",
    });
  });

  it("threadsCursorOf maps a missing lastEditDate to null", () => {
    const thread: Thread = { threadId: "t2" };
    expect(threadsCursorOf(thread)).toEqual({
      lastEditDate: null,
      threadId: "t2",
    });
  });

  it("messagesCursorOf serializes Date createdAt to ISO", () => {
    const message = {
      role: "user",
      content: "hi",
      id: "m1",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    } as ThreadMessageLike;
    expect(messagesCursorOf(message)).toEqual({
      createdAt: "2026-01-02T03:04:05.000Z",
      id: "m1",
    });
  });

  it("messagesCursorOf tolerates a message without id/createdAt", () => {
    const message = { role: "user", content: "hi" } as ThreadMessageLike;
    expect(messagesCursorOf(message)).toEqual({ createdAt: null, id: "" });
  });
});
