import { describe, expect, it } from "vitest";
import { groupThreadsByDate } from "../sub-components/ChatList.utils";
import type { Thread } from "../../../../types";

const LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  previous7: "Previous 7 Days",
  previous30: "Previous 30 Days",
  older: "Older",
};

// Fixed reference point: 2026-06-15 12:00 local time.
const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
const DAY = 86_400_000;

const thread = (id: string, lastEditDate?: number): Thread =>
  ({ threadId: id, lastEditDate }) as Thread;

const group = (
  threads: Thread[],
  now = NOW,
  locale = "en-US"
) => groupThreadsByDate(threads, now, locale, LABELS);

describe("groupThreadsByDate", () => {
  it("returns no groups for an empty list", () => {
    expect(group([])).toEqual([]);
  });

  it("buckets today / yesterday / previous 7 / previous 30", () => {
    const threads = [
      thread("today", NOW - 60_000), // a minute ago
      thread("yesterday", NOW - DAY),
      thread("prev7", NOW - 4 * DAY),
      thread("prev30", NOW - 20 * DAY),
    ];
    const groups = group(threads);
    expect(groups.map((g) => g.key)).toEqual([
      "today",
      "yesterday",
      "previous7",
      "previous30",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      "Previous 7 Days",
      "Previous 30 Days",
    ]);
    expect(groups.every((g) => g.threads.length === 1)).toBe(true);
  });

  it("buckets by start-of-day, not a rolling 24h window", () => {
    // 00:30 today is still "today" even though it is >12h before NOW.
    const earlyToday = new Date(2026, 5, 15, 0, 30, 0).getTime();
    // 23:30 yesterday is "yesterday" even though <13h before NOW.
    const lateYesterday = new Date(2026, 5, 14, 23, 30, 0).getTime();
    const groups = group([
      thread("a", earlyToday),
      thread("b", lateYesterday),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["today", "yesterday"]);
  });

  it("groups older threads by month (no year for the current year)", () => {
    const groups = group([thread("m", new Date(2026, 2, 10).getTime())]); // March 2026
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("m-2026-2");
    expect(groups[0].label).toBe("March");
  });

  it("includes the year for months in previous years", () => {
    const groups = group([thread("m", new Date(2025, 10, 3).getTime())]); // Nov 2025
    expect(groups[0].key).toBe("m-2025-10");
    expect(groups[0].label).toBe("November 2025");
  });

  it("merges threads from the same month into one ordered group", () => {
    const groups = group([
      thread("a", new Date(2026, 2, 20).getTime()),
      thread("b", new Date(2026, 2, 2).getTime()),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].threads.map((t) => t.threadId)).toEqual(["a", "b"]);
  });

  it("places undated threads in a trailing 'Older' group", () => {
    const groups = group([
      thread("today", NOW),
      thread("nodate", undefined),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["today", "older"]);
    expect(groups[1].label).toBe("Older");
    expect(groups[1].threads.map((t) => t.threadId)).toEqual(["nodate"]);
  });
});
