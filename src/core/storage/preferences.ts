import type { ReasoningLevel } from "../../shared/reasoning-level";

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
  //
  // Each method takes an optional opaque `entityId` last argument. When
  // provided the implementation should scope the read/write to that
  // entity ("room"); when omitted the unscoped (global) value is used.

  createDeepMode(value: boolean, entityId?: string): Promise<void>;

  readDeepMode(entityId?: string): Promise<boolean | null>;

  updateDeepMode(value: boolean, entityId?: string): Promise<void>;

  /**
   * Idempotent write — `create` if no value has been persisted yet in
   * the requested scope, `update` otherwise.
   */
  upsertDeepMode(value: boolean, entityId?: string): Promise<void>;

  deleteDeepMode(entityId?: string): Promise<void>;

  // --- Reasoning level (extended thinking depth) ---
  //
  // The depth that goes with the deep-mode toggle: deep mode stays the
  // on/off switch, this is how hard the model thinks while it is on. The
  // methods are optional so adapters written before the depth existed keep
  // compiling; `PreferencesEngine` falls back to its default depth when
  // they are absent. Same `entityId` scoping as deep mode.

  createReasoningLevel?(
    value: ReasoningLevel,
    entityId?: string
  ): Promise<void>;

  readReasoningLevel?(entityId?: string): Promise<ReasoningLevel | null>;

  updateReasoningLevel?(
    value: ReasoningLevel,
    entityId?: string
  ): Promise<void>;

  /** Idempotent write — see {@link upsertDeepMode}. */
  upsertReasoningLevel?(
    value: ReasoningLevel,
    entityId?: string
  ): Promise<void>;

  deleteReasoningLevel?(entityId?: string): Promise<void>;
}
