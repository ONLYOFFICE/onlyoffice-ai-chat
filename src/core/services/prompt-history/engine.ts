import { PROMPT_HISTORY_LIMIT, type PromptHistoryEngineDeps } from "./types";

/**
 * Sent-prompt history orchestrator — the terminal-style list the
 * composer walks with Up / Down.
 *
 * Two things it owns on top of raw storage:
 *
 * - **Normalization** — blank prompts are never recorded, and sending
 *   the same text twice in a row collapses into one entry (bash's
 *   `ignoredups`). Walking history is only useful if consecutive
 *   retries of one prompt don't bury everything before them.
 * - **Graceful degradation** — `storage.promptHistory` is optional. When
 *   the host adapter predates this slice the engine keeps the list in
 *   memory, so the keys still work for the current session and only the
 *   persistence across reloads is lost.
 *
 * The in-memory fallback is per-engine-instance and per-scope, which
 * matches the engine's lifetime: one widget instance, one map.
 */
export class PromptHistoryEngine {
  private readonly deps: PromptHistoryEngineDeps;
  private readonly limit: number;

  /**
   * Session-only fallback used when the adapter has no `promptHistory`
   * slice. Keyed by scope — `undefined` (unscoped) maps to the empty
   * string so it gets its own bucket rather than sharing one with an
   * scope literally named "undefined".
   */
  private readonly fallback = new Map<string, string[]>();

  constructor(
    deps: PromptHistoryEngineDeps,
    limit: number = PROMPT_HISTORY_LIMIT
  ) {
    this.deps = deps;
    this.limit = limit;
  }

  /** The storage slice, or `undefined` on adapters that predate it. */
  private get store() {
    return this.deps.storage.promptHistory;
  }

  private bucket(scopeId?: string): string[] {
    const key = scopeId ?? "";
    let list = this.fallback.get(key);
    if (!list) {
      list = [];
      this.fallback.set(key, list);
    }
    return list;
  }

  /**
   * History for the scope, **oldest first / newest last**, capped to the
   * engine limit. Never rejects: history is a convenience on top of the
   * composer, so a storage failure degrades to "no history" instead of
   * breaking the input.
   */
  async list(scopeId?: string, limit?: number): Promise<string[]> {
    const cap = limit ?? this.limit;
    const store = this.store;
    if (!store) return this.bucket(scopeId).slice(-cap);
    try {
      const items = await store.readAll(scopeId, cap);
      // An adapter may ignore `limit` (the contract allows it) — enforce
      // the cap here so callers always get a bounded list.
      return items.slice(-cap);
    } catch {
      return [];
    }
  }

  /**
   * Record a prompt the user just sent. Blank text and an immediate
   * repeat of the newest entry are dropped. Never rejects — failing to
   * remember a prompt must not fail the send that triggered it.
   */
  async record(text: string, scopeId?: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    const store = this.store;
    if (!store) {
      const list = this.bucket(scopeId);
      if (list[list.length - 1] === trimmed) return;
      list.push(trimmed);
      if (list.length > this.limit) list.splice(0, list.length - this.limit);
      return;
    }

    try {
      // Read-before-write purely to collapse consecutive duplicates; the
      // adapter stays a dumb append-only log so a server-side
      // implementation doesn't have to know the dedup rule.
      const existing = await store.readAll(scopeId, 1);
      if (existing[existing.length - 1] === trimmed) return;
      await store.append(trimmed, scopeId);
    } catch {
      // Swallowed on purpose — see the method doc.
    }
  }

  /** Forget the scope's history. Never rejects. */
  async clear(scopeId?: string): Promise<void> {
    this.fallback.delete(scopeId ?? "");
    try {
      await this.store?.clear(scopeId);
    } catch {
      // Swallowed on purpose — see {@link record}.
    }
  }
}
