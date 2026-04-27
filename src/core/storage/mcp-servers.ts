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
   * already exists.
   *
   * @param name - Unique server name.
   * @param config - Transport-specific configuration blob.
   */
  create(name: string, config: McpServerConfig): Promise<void>;

  /**
   * Look up a single server configuration by name.
   *
   * @param name - The server name to fetch.
   * @returns The configuration, or `null` if no entry exists.
   */
  readByName(name: string): Promise<McpServerConfig | null>;

  /**
   * Retrieve every registered server as a name→config map.
   */
  readAll(): Promise<Record<string, McpServerConfig>>;

  /**
   * Replace the configuration of an existing server. Throws if no server
   * with that name is registered.
   *
   * @param name - The server name to update.
   * @param config - The new transport-specific configuration.
   */
  update(name: string, config: McpServerConfig): Promise<void>;

  /**
   * Atomically replace the full registry. Bulk utility for imports and
   * restores; outside the strict CRUD surface.
   *
   * @param servers - The new complete set of servers.
   */
  replaceAll(servers: Record<string, McpServerConfig>): Promise<void>;

  /**
   * Remove a server by name. No-op if the entry is missing.
   *
   * @param name - The server name to remove.
   */
  delete(name: string): Promise<void>;
}
