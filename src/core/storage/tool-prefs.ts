/**
 * Storage interface for per-tool user preferences that are independent of
 * the tool's originating server.
 *
 * Holds two logically distinct sets, each exposed as a self-contained
 * CRUD quartet (`create`/`read`/`update`/`delete`):
 *
 * - **Disabled tools** — keyed by server type (`"web-search"`,
 *   `"image-generation"`, an MCP server name, a host-tool group id, …),
 *   value is the list of tool names within that server the user has turned
 *   off. Tools not in the map are enabled.
 * - **Auto-approved tools** — a flat list of `"type_name"` tokens that the
 *   user has chosen to always allow without per-call confirmation.
 */
export interface ToolPrefsStorage {
  // --- Disabled tools ---
  //
  // Each method takes an optional opaque `entityId` last argument. When
  // provided the implementation should scope the read/write to that
  // entity ("room"); when omitted the unscoped (global) entry is used.

  createDisabled(
    disabled: Record<string, string[]>,
    entityId?: string
  ): Promise<void>;

  readDisabled(entityId?: string): Promise<Record<string, string[]>>;

  updateDisabled(
    disabled: Record<string, string[]>,
    entityId?: string
  ): Promise<void>;

  /**
   * Idempotent write — `create` if no entry has been persisted yet in
   * the requested scope, `update` otherwise.
   */
  upsertDisabled(
    disabled: Record<string, string[]>,
    entityId?: string
  ): Promise<void>;

  deleteDisabled(entityId?: string): Promise<void>;

  // --- Auto-approved tools ---

  createAllowAlways(tokens: string[], entityId?: string): Promise<void>;

  readAllowAlways(entityId?: string): Promise<string[]>;

  updateAllowAlways(tokens: string[], entityId?: string): Promise<void>;

  /**
   * Idempotent write — `create` if no entry has been persisted yet in
   * the requested scope, `update` otherwise.
   */
  upsertAllowAlways(tokens: string[], entityId?: string): Promise<void>;

  deleteAllowAlways(entityId?: string): Promise<void>;
}
