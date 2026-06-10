import type { Thread } from "../../../../types";

export type ThreadGroup = {
  /** Stable identity for React keys (e.g. "today", "m-2026-3"). */
  key: string;
  /** Localized header text. */
  label: string;
  threads: Thread[];
};

export type ThreadGroupLabels = {
  today: string;
  yesterday: string;
  previous7: string;
  previous30: string;
  older: string;
};

const DAY_MS = 86_400_000;

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Bucket threads into recency groups for the chat-history list:
 * Today / Yesterday / Previous 7 Days / Previous 30 Days / by month
 * (month + year for previous years). Threads without a `lastEditDate`
 * land in a trailing "Older" group.
 *
 * Purely presentational — relies on `Thread.lastEditDate` only and makes
 * no storage/core calls. `threads` are expected pre-sorted by
 * `lastEditDate` descending (as `storage.threads.readAll` returns them),
 * so groups come out already ordered newest-first.
 */
export const groupThreadsByDate = (
  threads: Thread[],
  now: number,
  locale: string,
  labels: ThreadGroupLabels
): ThreadGroup[] => {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - DAY_MS;
  const last7Start = todayStart - 7 * DAY_MS;
  const last30Start = todayStart - 30 * DAY_MS;
  const currentYear = new Date(now).getFullYear();

  const groups: ThreadGroup[] = [];
  const byKey = new Map<string, ThreadGroup>();
  const undated: Thread[] = [];

  const push = (key: string, label: string, thread: Thread) => {
    let group = byKey.get(key);
    if (!group) {
      group = { key, label, threads: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.threads.push(thread);
  };

  for (const thread of threads) {
    const ts = thread.lastEditDate;
    if (ts === undefined) {
      undated.push(thread);
      continue;
    }

    const day = startOfDay(ts);
    if (day >= todayStart) {
      push("today", labels.today, thread);
    } else if (day >= yesterdayStart) {
      push("yesterday", labels.yesterday, thread);
    } else if (day >= last7Start) {
      push("previous7", labels.previous7, thread);
    } else if (day >= last30Start) {
      push("previous30", labels.previous30, thread);
    } else {
      const d = new Date(ts);
      const year = d.getFullYear();
      const key = `m-${year}-${d.getMonth()}`;
      const label = new Intl.DateTimeFormat(locale, {
        month: "long",
        ...(year === currentYear ? {} : { year: "numeric" }),
      }).format(d);
      push(key, label, thread);
    }
  }

  // Undated threads (no `lastEditDate`) always go last.
  if (undated.length > 0) {
    groups.push({ key: "older", label: labels.older, threads: undated });
  }

  return groups;
};
