import type { TMCPItem } from "../../../shared/mcp-item";
import type { McpServerConfig } from "../../storage";
import type {
  ToolsBulkResult,
  ToolsEngineDeps,
  ToolsMutationResult,
} from "./types";
import { validateServerName, validateTransportConfig } from "./validation";

/**
 * Tools-persistence orchestrator. Wraps `storage.mcpServers` and
 * `storage.toolPrefs` with the rules that plain CRUD can't express.
 *
 * Every method accepts an optional opaque `entityId` last argument that
 * the engine forwards to storage without inspecting it. Storage decides
 * what scoping means for each entry: typically `entityId` selects an
 * isolated per-entity namespace ("room") for the MCP server registry
 * and tool prefs, while `entityId === undefined` operates on the
 * unscoped (global) namespace.
 */
export class ToolsEngine {
  private readonly deps: ToolsEngineDeps;

  constructor(deps: ToolsEngineDeps) {
    this.deps = deps;
  }

  // ---------------------------------------------------------------------------
  // Custom MCP servers
  // ---------------------------------------------------------------------------

  async addCustomServer(
    name: string,
    config: McpServerConfig,
    entityId?: string
  ): Promise<ToolsMutationResult> {
    const error = validateServerName(name) ?? validateTransportConfig(config);
    if (error) return { success: false, error };

    const existing = await this.deps.storage.mcpServers.readByName(
      name,
      entityId
    );
    if (existing !== null) {
      return {
        success: false,
        error: { field: "name", message: `Server already registered: ${name}` },
      };
    }

    await this.deps.storage.mcpServers.create(name, config, entityId);
    return { success: true };
  }

  async updateCustomServer(
    name: string,
    config: McpServerConfig,
    entityId?: string
  ): Promise<ToolsMutationResult> {
    const error = validateTransportConfig(config);
    if (error) return { success: false, error };

    const existing = await this.deps.storage.mcpServers.readByName(
      name,
      entityId
    );
    if (existing === null) {
      return {
        success: false,
        error: { field: "name", message: `Server not registered: ${name}` },
      };
    }

    await this.deps.storage.mcpServers.update(name, config, entityId);
    return { success: true };
  }

  async removeCustomServer(name: string, entityId?: string): Promise<void> {
    await this.deps.storage.mcpServers.delete(name, entityId);
  }

  async getCustomServer(
    name: string,
    entityId?: string
  ): Promise<McpServerConfig | null> {
    return this.deps.storage.mcpServers.readByName(name, entityId);
  }

  async listCustomServers(
    entityId?: string
  ): Promise<Record<string, McpServerConfig>> {
    return this.deps.storage.mcpServers.readAll(entityId);
  }

  /**
   * Enumerate the host-configured system MCP servers' tools, grouped by
   * server type. Resolved server-side from the injected
   * {@link ToolsEngineDeps.systemToolsSource} (already connected and
   * listed) — the client renders permission cards from this in a single
   * fetch, with no browser-side MCP connections. Returns `{}` when no
   * system source is wired.
   */
  async listSystemTools(
    entityId?: string
  ): Promise<Record<string, TMCPItem[]>> {
    return (await this.deps.systemToolsSource?.getTools(entityId)) ?? {};
  }

  async replaceAllCustomServers(
    map: Record<string, McpServerConfig>,
    entityId?: string
  ): Promise<ToolsBulkResult> {
    const errors: Array<{
      name: string;
      error: ReturnType<typeof validateServerName>;
    }> = [];
    for (const [name, config] of Object.entries(map)) {
      const error = validateServerName(name) ?? validateTransportConfig(config);
      if (error) errors.push({ name, error });
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors: errors as Array<{
          name: string;
          error: NonNullable<(typeof errors)[0]["error"]>;
        }>,
      };
    }

    await this.deps.storage.mcpServers.replaceAll(map, entityId);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Tool prefs — disabled
  // ---------------------------------------------------------------------------

  async setDisabled(
    serverType: string,
    toolNames: string[],
    entityId?: string
  ): Promise<void> {
    const current = await this.deps.storage.toolPrefs.readDisabled(entityId);
    const next = { ...current };
    if (toolNames.length === 0) {
      delete next[serverType];
    } else {
      next[serverType] = [...toolNames];
    }
    await this.deps.storage.toolPrefs.upsertDisabled(next, entityId);
  }

  async getDisabled(entityId?: string): Promise<Record<string, string[]>> {
    return this.deps.storage.toolPrefs.readDisabled(entityId);
  }

  async isToolDisabled(
    serverType: string,
    toolName: string,
    entityId?: string
  ): Promise<boolean> {
    const disabled = await this.deps.storage.toolPrefs.readDisabled(entityId);
    return disabled[serverType]?.includes(toolName) ?? false;
  }

  // ---------------------------------------------------------------------------
  // Tool prefs — auto-approved
  // ---------------------------------------------------------------------------

  async setAllowAlways(
    _serverType: string,
    toolName: string,
    value: boolean,
    entityId?: string
  ): Promise<void> {
    const current = await this.deps.storage.toolPrefs.readAllowAlways(entityId);
    const has = current.includes(toolName);

    if (value && !has) {
      await this.deps.storage.toolPrefs.upsertAllowAlways(
        [...current, toolName],
        entityId
      );
    } else if (!value && has) {
      await this.deps.storage.toolPrefs.upsertAllowAlways(
        current.filter((t) => t !== toolName),
        entityId
      );
    }
  }

  async getAllowAlways(entityId?: string): Promise<string[]> {
    return this.deps.storage.toolPrefs.readAllowAlways(entityId);
  }

  async isAllowAlways(
    _serverType: string,
    toolName: string,
    entityId?: string
  ): Promise<boolean> {
    const list = await this.deps.storage.toolPrefs.readAllowAlways(entityId);
    return list.includes(toolName);
  }
}
