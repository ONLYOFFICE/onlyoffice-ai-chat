import type { AppContext } from "../app-context";
import type { TMCPItem } from "../types";

const MAX_TOOL_COUNT = 100;
const MAX_TOOL_COUNT_WITH_WEB_SEARCH = MAX_TOOL_COUNT + 2;

/**
 * Aggregated result from {@link ServersService.buildToolsList}, containing
 * the flat enabled-tools list, per-server tool maps, disabled-tool tracking,
 * and web-search status.
 *
 * @property tools - Flat array of enabled tools with prefixed names (e.g. `"host_toolName"`).
 * @property servers - Per-server-type map of all tools (including disabled).
 * @property disabledTools - Per-server-type list of disabled tool names.
 * @property webSearchEnabled - Whether web-search tools are currently active.
 */
export type ToolsListResult = {
  tools: TMCPItem[];
  servers: Record<string, TMCPItem[]>;
  disabledTools: Record<string, string[]>;
  webSearchEnabled: boolean;
};

/**
 * Result from {@link ServersService.changeToolStatus}. Returns the updated
 * state when the change succeeds, or `null` when the target tool was not
 * found or the max-tools limit would be exceeded.
 */
export type ChangeToolStatusResult = {
  tools: TMCPItem[];
  servers: Record<string, TMCPItem[]>;
  disabledTools: Record<string, string[]>;
  webSearchEnabled: boolean;
} | null;

/**
 * Manages MCP tool servers -- initialization from persisted settings,
 * building the flattened enabled-tools list (capped at 100, or 102 with
 * web search), toggling individual tool status, and dispatching tool calls.
 *
 * Custom server configurations are stored as serialized JSON in settings and
 * delegated to the underlying {@link AppContext.servers} adapter.
 */
export class ServersService {
  private serversKey: string;
  private disabledToolsKey: string;
  private ctx: AppContext;

  constructor(serversKey: string, disabledToolsKey: string, ctx: AppContext) {
    this.serversKey = serversKey;
    this.disabledToolsKey = disabledToolsKey;
    this.ctx = ctx;
  }

  /**
   * Load custom MCP server configurations from settings and start them.
   * Should be called once during application initialization. Invalid JSON
   * in settings is silently ignored.
   */
  initServers(): void {
    const settings = this.ctx.settings;
    const customServers = settings.get(this.serversKey);

    if (customServers) {
      try {
        const parsed = JSON.parse(customServers);
        this.ctx.servers.setCustomServers(parsed);
        this.ctx.servers.startCustomServers();
      } catch {
        // Ignore invalid JSON in settings
      }
    }
  }

  /**
   * Query all registered servers for their tools, merge with persisted
   * disabled-tools state, enforce the max-tool-count cap, and return the
   * aggregated result.
   *
   * Tools exceeding the cap are automatically added to the disabled list.
   *
   * @returns The full tools state including enabled list, per-server maps,
   *   disabled tracking, and web-search flag.
   */
  async buildToolsList(): Promise<ToolsListResult> {
    const allTools = await this.ctx.servers.getTools();
    const settings = this.ctx.settings;
    const disabledToolsStr = settings.get(this.disabledToolsKey);

    const tools: TMCPItem[] = [];
    const servers: Record<string, TMCPItem[]> = {};
    let webSearchEnabled = false;

    let parsedDisabledTools: Record<string, string[]> | null = null;
    if (disabledToolsStr) {
      try {
        parsedDisabledTools = JSON.parse(disabledToolsStr);
      } catch {
        // Ignore invalid JSON
      }
    }

    if (parsedDisabledTools) {
      const disabledTools = parsedDisabledTools;

      Object.entries(allTools).forEach(([type, serverTools]) => {
        if (type === "web-search") {
          servers[type] = [...serverTools];

          if (disabledTools["web-search"]?.length) {
            return;
          }

          const items = serverTools.map((tool) => ({
            ...tool,
            name: `${type}_${tool.name}`,
          }));

          disabledTools[type] = [];
          tools.push(...items);
          webSearchEnabled = serverTools.length > 0;
          return;
        }

        servers[type] = serverTools.map((tool) => {
          if (!disabledTools[type]) {
            disabledTools[type] = [];
          }
          const enabled = !disabledTools[type].includes(tool.name);

          const maxCount = webSearchEnabled
            ? MAX_TOOL_COUNT_WITH_WEB_SEARCH
            : MAX_TOOL_COUNT;
          if (enabled && tools.length >= maxCount) {
            disabledTools[type].push(tool.name);
            return { ...tool, enabled: false };
          }

          if (enabled) tools.push({ ...tool, name: `${type}_${tool.name}` });
          return { ...tool, enabled };
        });
      });

      return { tools, servers, disabledTools, webSearchEnabled };
    }

    const disabledTools: Record<string, string[]> = {};

    Object.entries(allTools).forEach(([type, serverTools]) => {
      disabledTools[type] = [];

      if (type === "web-search") {
        servers[type] = [...serverTools];
        const items = serverTools.map((tool) => ({
          ...tool,
          name: `${type}_${tool.name}`,
          enabled: true,
        }));
        tools.push(...items);
        webSearchEnabled = serverTools.length > 0;
        return;
      }

      const serverToolsWithStatus = serverTools.map((t, index) => {
        if (
          tools.length + index >=
          (webSearchEnabled ? MAX_TOOL_COUNT_WITH_WEB_SEARCH : MAX_TOOL_COUNT)
        ) {
          disabledTools[type].push(t.name);
          return { ...t, enabled: false };
        }
        return { ...t, enabled: true };
      });

      servers[type] = serverToolsWithStatus;
      tools.push(
        ...serverToolsWithStatus
          .filter((tool) => tool.enabled)
          .map((tool) => ({ ...tool, name: `${type}_${tool.name}` }))
      );
    });

    return { tools, servers, disabledTools, webSearchEnabled };
  }

  /**
   * Enable or disable a specific tool and persist the updated disabled-tools
   * map to settings.
   *
   * @param type - Server type the tool belongs to (e.g. `"host"`, `"web-search"`).
   * @param name - Tool name within the server.
   * @param enabled - Whether to enable (`true`) or disable (`false`) the tool.
   * @param currentState - Current tools state to derive the update from.
   * @returns Updated tools state, or `null` if the tool was not found or the
   *   max-tools limit prevents enabling.
   */
  changeToolStatus(
    type: string,
    name: string,
    enabled: boolean,
    currentState: {
      tools: TMCPItem[];
      servers: Record<string, TMCPItem[]>;
      disabledTools: Record<string, string[]>;
      webSearchEnabled: boolean;
    }
  ): ChangeToolStatusResult {
    const settings = this.ctx.settings;
    const { servers, disabledTools } = currentState;
    const tool = servers[type]?.find((t) => t.name === name);
    if (!tool) return null;

    let newTools: TMCPItem[];
    let newDisabledTools: Record<string, string[]>;
    let newWebSearchEnabled = currentState.webSearchEnabled;
    let newServers = servers;

    if (enabled) {
      if (type === "web-search") {
        newDisabledTools = { ...disabledTools, [type]: [] };
        newWebSearchEnabled = true;
        newServers = {
          ...servers,
          [type]: servers[type].map((t) => ({ ...t, enabled: true })),
        };
        newTools = currentState.tools;
        settings.set(this.disabledToolsKey, JSON.stringify(newDisabledTools));
        return {
          tools: newTools,
          servers: newServers,
          disabledTools: newDisabledTools,
          webSearchEnabled: newWebSearchEnabled,
        };
      }

      const maxCount = currentState.webSearchEnabled
        ? MAX_TOOL_COUNT_WITH_WEB_SEARCH
        : MAX_TOOL_COUNT;
      if (currentState.tools.length >= maxCount) return null;

      newDisabledTools = {
        ...disabledTools,
        [type]: disabledTools[type].filter((t) => t !== name),
      };
      newTools = [
        ...currentState.tools,
        { ...tool, name: `${type}_${tool.name}` },
      ];
      settings.set(this.disabledToolsKey, JSON.stringify(newDisabledTools));
    } else {
      const disabled = [...disabledTools[type], name];
      newDisabledTools = { ...disabledTools, [type]: disabled };

      if (type === "web-search") {
        newDisabledTools[type] = servers[type].map((t) => t.name);
        newWebSearchEnabled = false;
        newTools = currentState.tools.filter((t) => !t.name.includes(type));
      } else {
        newTools = currentState.tools.filter(
          (t) => t.name !== `${type}_${name}`
        );
      }

      settings.set(this.disabledToolsKey, JSON.stringify(newDisabledTools));
    }

    newServers = {
      ...servers,
      [type]: servers[type].map((t) => {
        if (t.name === name) return { ...t, enabled };
        return t;
      }),
    };

    return {
      tools: newTools,
      servers: newServers,
      disabledTools: newDisabledTools,
      webSearchEnabled: newWebSearchEnabled,
    };
  }

  /**
   * Execute a tool call by dispatching to the appropriate server, after
   * verifying the tool is not disabled.
   *
   * @param name - The prefixed tool name (e.g. `"host_myTool"`).
   * @param args - Arguments to pass to the tool.
   * @param disabledTools - Current disabled-tools map; calls to disabled tools
   *   are silently skipped.
   * @returns The tool execution result, or `undefined` if the tool is disabled.
   */
  async callTools(
    name: string,
    args: Record<string, unknown>,
    disabledTools: Record<string, string[]>
  ): Promise<unknown> {
    const servers = this.ctx.servers;
    const type = servers.getServerType(name);
    const toolName = name.replace(`${type}_`, "");

    if (disabledTools[type]?.includes(toolName)) return;

    return servers.callTools(type, toolName, args);
  }

  checkAllowAlways(type: string, name: string): boolean {
    return this.ctx.servers.checkAllowAlways(type, name);
  }

  setAllowAlways(value: boolean, type: string, name: string): void {
    this.ctx.servers.setAllowAlways(value, type, name);
  }

  getConfig(): Record<string, Record<string, unknown>> {
    const settings = this.ctx.settings;
    const raw = settings.get(this.serversKey);
    if (!raw) return { mcpServers: {} };
    try {
      return JSON.parse(raw);
    } catch {
      return { mcpServers: {} };
    }
  }

  saveConfig(config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }): void {
    const settings = this.ctx.settings;
    const currConfig = config.mcpServers ? config : { mcpServers: {} };
    settings.set(this.serversKey, JSON.stringify(currConfig));
    this.ctx.servers.setCustomServers(currConfig);
    this.ctx.servers.startCustomServers();
  }

  deleteCustomServer(name: string): void {
    this.ctx.servers.deleteCustomServer(name);
    const config = this.getConfig();
    delete config.mcpServers[name];
    this.ctx.settings.set(this.serversKey, JSON.stringify(config));
  }

  getCustomServersLogs(): Record<string, string[]> {
    return this.ctx.servers.getCustomServersLogs();
  }

  getWebSearchEnabled(): boolean {
    return this.ctx.servers.getWebSearchEnabled();
  }
}
