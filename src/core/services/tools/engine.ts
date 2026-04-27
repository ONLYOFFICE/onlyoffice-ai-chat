import type { McpServerConfig } from "../../storage";
import type {
  ToolsBulkResult,
  ToolsEngineDeps,
  ToolsMutationResult,
} from "./types";
import { validateServerName, validateTransportConfig } from "./validation";

/**
 * Tools-persistence orchestrator. Wraps `storage.mcpServers` and
 * `storage.toolPrefs` with the rules that plain CRUD can't express:
 *
 * - **Server-name + transport-config validation** for custom MCP
 *   servers, surfaced as `TErrorData` for the settings form.
 * - **Idempotent writes** for both server registrations and tool
 *   prefs — no `create` vs `update` branching at call sites.
 * - **Bulk import** with all-or-nothing semantics.
 * - **Token format** for the auto-approve list (`${serverType}_${toolName}`)
 *   centralized so callers never reconstruct it themselves.
 *
 * The engine is **persistence-only** — it does not manage live MCP
 * connections, fetch `tools/list` from a running server, or dispatch
 * tool calls. Those concerns live in the runtime `Servers` aggregator
 * (`src/tools/servers.ts`), which is browser/transport-bound. The
 * engine is the part that runs equally on the server.
 */
export class ToolsEngine {
  private readonly deps: ToolsEngineDeps;

  constructor(deps: ToolsEngineDeps) {
    this.deps = deps;
  }

  // ---------------------------------------------------------------------------
  // Custom MCP servers
  // ---------------------------------------------------------------------------

  /**
   * Register a new custom MCP server. Validates the name and the
   * transport-config shape. Returns `{ success: false, error }`
   * without writing if either check fails or the name already exists.
   */
  async addCustomServer(
    name: string,
    config: McpServerConfig
  ): Promise<ToolsMutationResult> {
    const error = validateServerName(name) ?? validateTransportConfig(config);
    if (error) return { success: false, error };

    const existing = await this.deps.storage.mcpServers.readByName(name);
    if (existing !== null) {
      return {
        success: false,
        error: { field: "name", message: `Server already registered: ${name}` },
      };
    }

    await this.deps.storage.mcpServers.create(name, config);
    return { success: true };
  }

  /**
   * Replace the configuration of an existing server. Validates the
   * transport-config shape. Returns `{ success: false, error }` if the
   * server does not exist or the config is invalid.
   */
  async updateCustomServer(
    name: string,
    config: McpServerConfig
  ): Promise<ToolsMutationResult> {
    const error = validateTransportConfig(config);
    if (error) return { success: false, error };

    const existing = await this.deps.storage.mcpServers.readByName(name);
    if (existing === null) {
      return {
        success: false,
        error: { field: "name", message: `Server not registered: ${name}` },
      };
    }

    await this.deps.storage.mcpServers.update(name, config);
    return { success: true };
  }

  /**
   * Remove a custom MCP server registration. No-op if the server does
   * not exist. Does not touch `toolPrefs` — disabled / auto-approved
   * entries for tools from the removed server become inert (the live
   * tool system never calls them) and are cleaned up the next time the
   * user opens the tools panel.
   */
  async removeCustomServer(name: string): Promise<void> {
    await this.deps.storage.mcpServers.delete(name);
  }

  /** Read a single server config, or `null` if not registered. */
  async getCustomServer(name: string): Promise<McpServerConfig | null> {
    return this.deps.storage.mcpServers.readByName(name);
  }

  /** List every registered server as a `name → config` map. */
  async listCustomServers(): Promise<Record<string, McpServerConfig>> {
    return this.deps.storage.mcpServers.readAll();
  }

  /**
   * Atomically replace the entire custom-server registry. Validates
   * every entry first; writes nothing if any entry is invalid so the
   * registry is never observed in a half-imported state.
   *
   * Used for import / restore flows.
   */
  async replaceAllCustomServers(
    map: Record<string, McpServerConfig>
  ): Promise<ToolsBulkResult> {
    const errors: Array<{ name: string; error: ReturnType<typeof validateServerName> }> = [];
    for (const [name, config] of Object.entries(map)) {
      const error = validateServerName(name) ?? validateTransportConfig(config);
      if (error) errors.push({ name, error });
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors: errors as Array<{ name: string; error: NonNullable<typeof errors[0]["error"]> }>,
      };
    }

    await this.deps.storage.mcpServers.replaceAll(map);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Tool prefs — disabled
  // ---------------------------------------------------------------------------

  /**
   * Replace the disabled-tool list for a single server type. Pass an
   * empty array to clear the list for that server. Other servers'
   * entries are preserved.
   */
  async setDisabled(serverType: string, toolNames: string[]): Promise<void> {
    const current = await this.deps.storage.toolPrefs.readDisabled();
    const next = { ...current };
    if (toolNames.length === 0) {
      delete next[serverType];
    } else {
      next[serverType] = [...toolNames];
    }
    await this.deps.storage.toolPrefs.upsertDisabled(next);
  }

  /** Read the full disabled-tool map. Direct passthrough. */
  async getDisabled(): Promise<Record<string, string[]>> {
    return this.deps.storage.toolPrefs.readDisabled();
  }

  /** Convenience: is `toolName` currently disabled under `serverType`? */
  async isToolDisabled(
    serverType: string,
    toolName: string
  ): Promise<boolean> {
    const disabled = await this.deps.storage.toolPrefs.readDisabled();
    return disabled[serverType]?.includes(toolName) ?? false;
  }

  // ---------------------------------------------------------------------------
  // Tool prefs — auto-approved
  // ---------------------------------------------------------------------------

  /**
   * Toggle auto-approve for a single tool. Token format is
   * `${serverType}_${toolName}` — callers don't construct it, the
   * engine does.
   */
  async setAllowAlways(
    serverType: string,
    toolName: string,
    value: boolean
  ): Promise<void> {
    const token = `${serverType}_${toolName}`;
    const current = await this.deps.storage.toolPrefs.readAllowAlways();
    const has = current.includes(token);

    if (value && !has) {
      await this.deps.storage.toolPrefs.upsertAllowAlways([...current, token]);
    } else if (!value && has) {
      await this.deps.storage.toolPrefs.upsertAllowAlways(
        current.filter((t) => t !== token)
      );
    }
  }

  /** Read the flat list of auto-approve tokens. Direct passthrough. */
  async getAllowAlways(): Promise<string[]> {
    return this.deps.storage.toolPrefs.readAllowAlways();
  }

  /** Convenience: is `toolName` under `serverType` auto-approved? */
  async isAllowAlways(
    serverType: string,
    toolName: string
  ): Promise<boolean> {
    const list = await this.deps.storage.toolPrefs.readAllowAlways();
    return list.includes(`${serverType}_${toolName}`);
  }
}
