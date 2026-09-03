import type { McpServerConfig } from "../../storage";
import type {
  ToolsBulkResult,
  ToolsEngineDeps,
  ToolsMutationResult,
  TSystemToolsListing,
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
  async listSystemTools(entityId?: string): Promise<TSystemToolsListing> {
    const source = this.deps.systemToolsSource;
    if (!source) return {};
    // A source that can report per-server enumeration failures returns the
    // richer `{ groups, errors }` shape, so a client with no local access
    // to the servers can still show why one delivered no tools. Sources
    // with plain `getTools` keep the legacy grouped map.
    if (typeof source.getToolsWithErrors === "function") {
      return source.getToolsWithErrors(entityId);
    }
    return (await source.getTools(entityId)) ?? {};
  }

  async replaceAllCustomServers(
    map: Record<string, McpServerConfig>,
    entityId?: string
  ): Promise<ToolsBulkResult> {
    const errors: Array<{
      name: string;
      error: ReturnType<typeof validateServerName>;
    }> = [];
    // Name lookups are case-insensitive downstream (the DocSpace backend
    // resolves names on a CI collation), so two keys differing only by case
    // would collide on every read/update/delete while both rows persist —
    // the second one becomes unreachable. Mirror addCustomServer's
    // uniqueness rule and reject the batch up front (Bug 82984).
    const seen = new Set<string>();
    for (const name of Object.keys(map)) {
      const folded = name.toLowerCase();
      if (seen.has(folded)) {
        errors.push({
          name,
          error: {
            field: "name",
            message: `Duplicate server name (names are case-insensitive): ${name}`,
          },
        });
      }
      seen.add(folded);
    }
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
    serverType: string,
    toolName: string,
    value: boolean,
    entityId?: string
  ): Promise<void> {
    // The persisted list holds `${serverType}_${toolName}` tokens — the
    // format the live round uses (see validateServerName) and what the
    // approval dialog pins. Storing the bare tool name here let the
    // permission leak onto same-named tools of every other server
    // (DocSpace bug 83161).
    const token = `${serverType}_${toolName}`;
    const current = await this.deps.storage.toolPrefs.readAllowAlways(entityId);
    const has = current.includes(token);

    if (value && !has) {
      await this.deps.storage.toolPrefs.upsertAllowAlways(
        [...current, token],
        entityId
      );
    } else if (!value && has) {
      await this.deps.storage.toolPrefs.upsertAllowAlways(
        current.filter((t) => t !== token),
        entityId
      );
    }
  }

  async getAllowAlways(entityId?: string): Promise<string[]> {
    return this.deps.storage.toolPrefs.readAllowAlways(entityId);
  }

  async isAllowAlways(
    serverType: string,
    toolName: string,
    entityId?: string
  ): Promise<boolean> {
    // Same `${serverType}_${toolName}` token as setAllowAlways above — a
    // bare-name match answered `true` for any server carrying a tool with
    // that name (DocSpace bug 83161).
    const list = await this.deps.storage.toolPrefs.readAllowAlways(entityId);
    return list.includes(`${serverType}_${toolName}`);
  }
}
