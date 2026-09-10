import type { ReasoningLevel } from "../../../shared/reasoning-level";
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
   * Read the deep-mode toggle in scope, falling back to the configured
   * default when no value has been persisted. `entityId` is opaque to
   * the engine and forwarded to storage.
   */
  async getDeepMode(entityId?: string): Promise<boolean> {
    const stored = await this.deps.storage.preferences.readDeepMode(entityId);
    return stored ?? this.defaults.deepMode;
  }

  /**
   * Persist the deep-mode toggle in scope. Idempotent — safe to call
   * without checking whether a value has already been written.
   */
  async setDeepMode(value: boolean, entityId?: string): Promise<void> {
    await this.deps.storage.preferences.upsertDeepMode(value, entityId);
  }

  /**
   * Clear the persisted toggle in scope. Future {@link getDeepMode}
   * calls fall back to the configured default.
   */
  async clearDeepMode(entityId?: string): Promise<void> {
    await this.deps.storage.preferences.deleteDeepMode(entityId);
  }

  /**
   * True when the user has explicitly persisted a value in scope
   * (regardless of whether it's `true` or `false`).
   */
  async isDeepModeSet(entityId?: string): Promise<boolean> {
    const stored = await this.deps.storage.preferences.readDeepMode(entityId);
    return stored !== null;
  }

  // ---------------------------------------------------------------------------
  // Reasoning level (extended thinking depth)
  // ---------------------------------------------------------------------------

  /**
   * The effective extended-thinking depth in scope.
   *
   * Deep mode stays the master switch: off means `"off"` whatever depth was
   * persisted, so a host that only knows the boolean (an older settings
   * page, a server without the depth route) keeps full control. While on,
   * the persisted depth is returned, falling back to the configured default
   * when none was stored or the adapter predates the depth methods.
   */
  async getReasoningLevel(entityId?: string): Promise<ReasoningLevel> {
    if (!(await this.getDeepMode(entityId))) return "off";
    const stored =
      (await this.deps.storage.preferences.readReasoningLevel?.(entityId)) ??
      null;
    return stored !== null && stored !== "off"
      ? stored
      : this.defaults.reasoningLevel;
  }

  /**
   * Persist a depth in scope. Writes the deep-mode toggle first so the two
   * never disagree, then the depth itself — only when it is a real depth:
   * `"off"` leaves the previously chosen depth in place, so switching back
   * on restores it. Silently skips the depth on adapters without the
   * optional methods; the toggle still lands.
   */
  async setReasoningLevel(
    value: ReasoningLevel,
    entityId?: string
  ): Promise<void> {
    await this.setDeepMode(value !== "off", entityId);
    if (value === "off") return;
    await this.deps.storage.preferences.upsertReasoningLevel?.(value, entityId);
  }
}
