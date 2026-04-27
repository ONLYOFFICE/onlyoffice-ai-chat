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

  /**
   * Save the disabled-tools map for the first time. Throws if one already
   * exists.
   */
  createDisabled(disabled: Record<string, string[]>): Promise<void>;

  /**
   * Read the disabled-tools map.
   *
   * @returns The persisted map, or `{}` if nothing is stored.
   */
  readDisabled(): Promise<Record<string, string[]>>;

  /**
   * Replace the existing disabled-tools map. Throws if none exists.
   */
  updateDisabled(disabled: Record<string, string[]>): Promise<void>;

  /**
   * Idempotent write — `create` if no entry has been persisted yet,
   * `update` otherwise. Lets callers replace the disabled-tools map
   * without first checking whether the row exists.
   */
  upsertDisabled(disabled: Record<string, string[]>): Promise<void>;

  /**
   * Clear every disabled-tool entry. Subsequent `readDisabled()` calls
   * return `{}`.
   */
  deleteDisabled(): Promise<void>;

  // --- Auto-approved tools ---

  /**
   * Save the auto-approved list for the first time. Throws if one already
   * exists.
   */
  createAllowAlways(tokens: string[]): Promise<void>;

  /**
   * Read the flat list of auto-approved `"type_name"` tokens.
   *
   * @returns The persisted list, or `[]` if nothing is stored.
   */
  readAllowAlways(): Promise<string[]>;

  /**
   * Replace the existing auto-approved list. Throws if none exists.
   */
  updateAllowAlways(tokens: string[]): Promise<void>;

  /**
   * Idempotent write — `create` if no entry has been persisted yet,
   * `update` otherwise. Lets callers replace the auto-approved list
   * without first checking whether the row exists.
   */
  upsertAllowAlways(tokens: string[]): Promise<void>;

  /**
   * Clear the auto-approved list. Subsequent `readAllowAlways()` calls
   * return `[]`.
   */
  deleteAllowAlways(): Promise<void>;
}
