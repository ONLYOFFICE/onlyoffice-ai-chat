/**
 * One MCP server configuration. The shape is intentionally open — MCP
 * allows per-transport fields (`command`/`args` for stdio, `url` for HTTP,
 * plus env, headers, etc.) and the storage layer stays agnostic to which
 * transport is in use.
 */
export type McpServerConfig = Record<string, unknown>;

/**
 * Storage interface for custom MCP server registrations. Each entry is
 * keyed by a user-supplied server name (unique within the registry).
 */
export interface McpServersStorage {
  /**
   * Register a new server by name. Throws if a server with the same name
   * already exists in the same scope.
   *
   * `entityId` is opaque to the caller — when provided the implementation
   * should scope the registry to that entity (so two entities can each
   * have a server named `"foo"` without colliding); when omitted the
   * unscoped (global) registry is used.
   */
  create(
    name: string,
    config: McpServerConfig,
    entityId?: string
  ): Promise<void>;

  /**
   * Look up a single server configuration by name in the requested scope.
   * Returns `null` when the server does not exist in that scope.
   */
  readByName(
    name: string,
    entityId?: string
  ): Promise<McpServerConfig | null>;

  /** Retrieve every registered server in the requested scope. */
  readAll(entityId?: string): Promise<Record<string, McpServerConfig>>;

  /**
   * Replace the configuration of an existing server. Throws if no server
   * with that name is registered in the requested scope.
   */
  update(
    name: string,
    config: McpServerConfig,
    entityId?: string
  ): Promise<void>;

  /**
   * Atomically replace the full registry in the requested scope. Bulk
   * utility for imports and restores; outside the strict CRUD surface.
   */
  replaceAll(
    servers: Record<string, McpServerConfig>,
    entityId?: string
  ): Promise<void>;

  /**
   * Remove a server by name from the requested scope. No-op if the
   * entry is missing.
   */
  delete(name: string, entityId?: string): Promise<void>;
}
