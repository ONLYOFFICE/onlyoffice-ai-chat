import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ServersService } from "../services/servers";
import type { TMCPItem } from "../types";

/**
 * Zustand state for MCP (Model Context Protocol) servers, tools, and
 * web search integration.
 *
 * Manages the registry of connected MCP servers, the flattened list of
 * available tools, per-tool enable/disable state, and operations for
 * invoking tools, editing server configs, and controlling the web search
 * toggle.
 */
export interface ServersStoreState {
  /** Map of server name to its list of tools. */
  servers: Record<string, TMCPItem[]>;
  /** Flattened list of all available tools across every server. */
  tools: TMCPItem[];
  /** Map of server type to an array of disabled tool names. */
  disabledTools: Record<string, string[]>;
  /** Context for the "manage tool" dialog (the message that triggered it). */
  manageToolData?: {
    message: ThreadMessageLike;
    idx: number;
    messageUID: string;
  };
  /** Whether the built-in web search tool is enabled. */
  webSearchEnabled: boolean;
  /** Initialize MCP server connections. */
  initServers: () => void;
  /** Rebuild the full tools list from all servers and update state. */
  getTools: () => Promise<void>;
  /** Enable or disable a specific tool by server type and tool name. */
  changeToolStatus: (type: string, name: string, enabled: boolean) => void;
  /** Invoke a tool by name with the given arguments. */
  callTools: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Check whether a tool is set to "always allow" (skip approval). */
  checkAllowAlways: (type: string, name: string) => boolean;
  /** Set or clear the "always allow" flag for a tool. */
  setAllowAlways: (value: boolean, type: string, name: string) => void;
  /** Set the data for the manage-tool dialog. */
  setManageToolData: (data: ServersStoreState["manageToolData"]) => void;
  /** Persist an MCP server configuration object. */
  saveConfig: (config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => void;
  /** Retrieve the current MCP server configuration. */
  getConfig: () => Record<string, Record<string, unknown>>;
  /** Remove a custom MCP server by name. */
  deleteCustomServer: (name: string) => void;
  /** Retrieve logs from all custom MCP servers. */
  getCustomServersLogs: () => Record<string, string[]>;
  /** Check whether web search is enabled in the settings. */
  getWebSearchEnabled: () => boolean;
}

export function createServersStore(deps: {
  serversService: ServersService;
}): UseBoundStore<StoreApi<ServersStoreState>> {
  const { serversService } = deps;

  return create<ServersStoreState>((set, get) => ({
    servers: {},
    tools: [],
    disabledTools: {},
    manageToolData: undefined,
    webSearchEnabled: false,

    initServers: () => {
      serversService.initServers();
    },

    getTools: async () => {
      const result = await serversService.buildToolsList();
      set({
        tools: result.tools,
        servers: result.servers,
        disabledTools: result.disabledTools,
        webSearchEnabled: result.webSearchEnabled,
      });
    },

    changeToolStatus: (type, name, enabled) => {
      const { tools, servers, disabledTools, webSearchEnabled } = get();
      const result = serversService.changeToolStatus(type, name, enabled, {
        tools,
        servers,
        disabledTools,
        webSearchEnabled,
      });
      if (result) {
        set({
          tools: result.tools,
          servers: result.servers,
          disabledTools: result.disabledTools,
          webSearchEnabled: result.webSearchEnabled,
        });
      }
    },

    callTools: async (name, args) => {
      return serversService.callTools(name, args, get().disabledTools);
    },

    checkAllowAlways: (type, name) => {
      return serversService.checkAllowAlways(type, name);
    },

    setAllowAlways: (value, type, name) => {
      serversService.setAllowAlways(value, type, name);
    },

    setManageToolData: (data) => {
      set({ manageToolData: data });
    },

    getConfig: () => serversService.getConfig(),

    saveConfig: (config) => {
      serversService.saveConfig(config);
    },

    deleteCustomServer: (name) => {
      serversService.deleteCustomServer(name);
    },

    getCustomServersLogs: () => serversService.getCustomServersLogs(),

    getWebSearchEnabled: () => serversService.getWebSearchEnabled(),
  }));
}
