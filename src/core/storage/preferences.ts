/**
 * Storage interface for small scalar user preferences.
 *
 * Each preference gets its own typed CRUD quartet
 * (`create*`/`read*`/`update*`/`delete*`) so the contract stays explicit —
 * no stringly-typed keys, no JSON parsing at call sites. `create` throws
 * if the preference is already set; `update` throws if it is not.
 */
export interface PreferencesStorage {
  // --- Deep mode (extended thinking toggle) ---

  /**
   * Persist the deep-mode toggle for the first time. Throws if already set.
   */
  createDeepMode(value: boolean): Promise<void>;

  /**
   * Read the deep-mode toggle.
   *
   * @returns The persisted boolean, or `null` if never set.
   */
  readDeepMode(): Promise<boolean | null>;

  /**
   * Replace the deep-mode toggle. Throws if never set.
   */
  updateDeepMode(value: boolean): Promise<void>;

  /**
   * Idempotent write — `create` if the toggle has never been
   * persisted, `update` otherwise. Used by `PreferencesEngine` to
   * collapse the create/update branch into a single call.
   */
  upsertDeepMode(value: boolean): Promise<void>;

  /**
   * Clear the deep-mode toggle so future reads fall back to the
   * application default.
   */
  deleteDeepMode(): Promise<void>;
}
