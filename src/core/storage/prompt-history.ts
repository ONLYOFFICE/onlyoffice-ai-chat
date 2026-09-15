/**
 * Storage interface for the composer's sent-prompt history — the list
 * the user walks with Up / Down in the input, terminal-style.
 *
 * This is deliberately NOT the message log: it records what the user
 * *typed and sent*, edits and retries included, rather than the
 * conversation that resulted, and it outlives the widget instance so
 * reopening a chat brings its prompts back.
 *
 * The scope is whatever token the caller passes — the UI scopes by
 * thread, so each chat walks its own prompts — and this layer treats it
 * as opaque.
 *
 * The whole slice is optional on {@link StorageAdapter}: adapters written
 * before history existed keep compiling, and `PromptHistoryEngine`
 * degrades to a session-only in-memory list when it is absent.
 */
export interface PromptHistoryStorage {
  /**
   * Append one sent prompt to the end of the scope's history (newest
   * last). Implementations should treat this as idempotent-ish: see
   * {@link PromptHistoryEngine.record}, which already drops blanks and
   * collapses a repeat of the newest entry before calling here.
   *
   * @param text - The prompt exactly as sent.
   * @param scopeId - Optional opaque scope token; the UI passes the
   *   thread id. When omitted the unscoped (passthrough) history is used.
   */
  append(text: string, scopeId?: string): Promise<void>;

  /**
   * Read the scope's history in chronological order — **oldest first,
   * newest last**. The Up key walks this array backwards from the end.
   *
   * @param scopeId - Optional opaque scope token; the UI passes the
   *   thread id.
   * @param limit - Optional cap. When set, return at most the `limit`
   *   MOST RECENT entries (still oldest-first within the slice), so a
   *   long-lived chat doesn't ship its entire past to the client.
   *   Implementations that ignore it simply return everything.
   */
  readAll(scopeId?: string, limit?: number): Promise<string[]>;

  /**
   * Drop the scope's history entirely.
   *
   * @param scopeId - Optional opaque scope token; the UI passes the
   *   thread id.
   */
  clear(scopeId?: string): Promise<void>;
}
