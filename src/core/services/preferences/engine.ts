import {
  DEFAULT_PREFERENCES,
  type PreferenceDefaults,
  type PreferencesEngineDeps,
} from "./types";

/**
 * Preferences orchestrator. Wraps `storage.preferences` with two
 * conveniences:
 *
 * - **Default fallback** — `getDeepMode()` returns the configured
 *   default when nothing has been persisted, so callers don't have
 *   to handle the `null` from `readDeepMode()` themselves.
 * - **Idempotent writes** — `setDeepMode(value)` collapses the
 *   `create` / `update` branch into a single
 *   `storage.preferences.upsertDeepMode` call.
 *
 * The shape is intentionally extensible: each new scalar pref adds
 * a `get`/`set`/`clear`/`isSet` quartet on the engine and a
 * matching `create`/`read`/`update`/`upsert`/`delete` quintet on
 * `PreferencesStorage`. The natural next candidate is the
 * system-prompt appendix currently exposed through the widget's
 * imperative API — migrate it here once the storage contract grows
 * the four methods.
 */
export class PreferencesEngine {
  private readonly deps: PreferencesEngineDeps;
  private readonly defaults: PreferenceDefaults;

  constructor(
    deps: PreferencesEngineDeps,
    defaults?: Partial<PreferenceDefaults>
  ) {
    this.deps = deps;
    this.defaults = { ...DEFAULT_PREFERENCES, ...defaults };
  }

  // ---------------------------------------------------------------------------
  // Deep mode (extended thinking toggle)
  // ---------------------------------------------------------------------------

  /**
   * Read the deep-mode toggle, falling back to the configured
   * default when no value has been persisted.
   */
  async getDeepMode(): Promise<boolean> {
    const stored = await this.deps.storage.preferences.readDeepMode();
    return stored ?? this.defaults.deepMode;
  }

  /**
   * Persist the deep-mode toggle. Idempotent — safe to call without
   * checking whether a value has already been written.
   */
  async setDeepMode(value: boolean): Promise<void> {
    await this.deps.storage.preferences.upsertDeepMode(value);
  }

  /**
   * Clear the persisted toggle. Future {@link getDeepMode} calls
   * fall back to the configured default.
   */
  async clearDeepMode(): Promise<void> {
    await this.deps.storage.preferences.deleteDeepMode();
  }

  /**
   * True when the user has explicitly persisted a value (regardless
   * of whether it's `true` or `false`). Use this to distinguish
   * "user opted in/out" from "never set".
   */
  async isDeepModeSet(): Promise<boolean> {
    const stored = await this.deps.storage.preferences.readDeepMode();
    return stored !== null;
  }
}
