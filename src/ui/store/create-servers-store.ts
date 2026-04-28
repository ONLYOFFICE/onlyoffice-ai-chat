import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import type { CallbacksManager } from "../events";
import type { ServerAPI } from "../providers/ApiProvider";
import type { TMCPItem } from "../../types";

/**
 * Zustand state for MCP servers, tools, and web search integration.
 *
 * CRUD persistence is delegated to {@link ServerAPI} (`api.tools`,
 * `api.webSearch`); runtime tool dispatch is delegated to the live
 * {@link Servers} instance on {@link AppContext}.
 */
export interface ServersStoreState {
  servers: Record<string, TMCPItem[]>;
  tools: TMCPItem[];
  disabledTools: Record<string, string[]>;
  manageToolData?: {
    threadId: string;
    message: ThreadMessageLike;
    idx: number;
    messageId: string;
  };
  webSearchEnabled: boolean;
  initServers: () => void;
  getTools: () => Promise<void>;
  reload: () => Promise<void>;
  changeToolStatus: (
    type: string,
    name: string,
    enabled: boolean
  ) => Promise<void>;
  callTools: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  setManageToolData: (data: ServersStoreState["manageToolData"]) => void;
  saveConfig: (config: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => Promise<void>;
  getConfig: () => Promise<Record<string, Record<string, unknown>>>;
  deleteCustomServer: (name: string) => Promise<void>;
  getCustomServersLogs: () => Record<string, string[]>;
  getWebSearchEnabled: () => Promise<boolean>;
}

export function createServersStore(deps: {
  ctx: AppContext;
  api: ServerAPI;
  callbacksManager: CallbacksManager;
}): UseBoundStore<StoreApi<ServersStoreState>> {
  const { ctx, api, callbacksManager } = deps;

  const buildToolsList = async () => {
    const grouped = await ctx.servers.getTools();
    const disabled = await api.tools.getDisabled();
    const webSearchEnabled = await api.webSearch.isConfigured();

    // Annotate each tool with its `enabled` flag derived from the
    // persisted disabled list — used by the permissions UI to render
    // toggles. `flat` carries every tool (disabled-filter is applied by
    // the engine in `buildToolContext`) so the chat receives the full
    // provider list.
    const annotated: Record<string, TMCPItem[]> = {};
    const flat: TMCPItem[] = [];
    for (const [type, items] of Object.entries(grouped)) {
      const disabledForType = disabled[type] ?? [];
      annotated[type] = items.map((tool) => ({
        ...tool,
        enabled:
          tool.enabled !== undefined
            ? tool.enabled
            : !disabledForType.includes(tool.name),
      }));
      flat.push(...annotated[type]);
    }

    return {
      tools: flat,
      servers: annotated,
      disabledTools: disabled,
      webSearchEnabled,
    };
  };

  return create<ServersStoreState>((set, get) => ({
    servers: {},
    tools: [],
    disabledTools: {},
    manageToolData: undefined,
    webSearchEnabled: false,

    initServers: () => {
      ctx.servers.startCustomServers();
    },

    getTools: async () => {
      const result = await buildToolsList();
      set(result);
    },

    reload: async () => {
      ctx.servers.startCustomServers();
      const result = await buildToolsList();
      set(result);
    },

    changeToolStatus: async (type, name, enabled) => {
      const current = get().disabledTools[type] ?? [];
      const next = enabled
        ? current.filter((n) => n !== name)
        : Array.from(new Set([...current, name]));
      await api.tools.setDisabled(type, next);

      const built = await buildToolsList();
      set(built);
      callbacksManager.emit("onServersUpdated", {
        kind: "tool-toggled",
        toolType: type,
        toolName: name,
        enabled,
      });
    },

    callTools: (name, args) => {
      const type = ctx.servers.getServerType(name);
      return ctx.servers.callTools(type, name, args);
    },

    setManageToolData: (data) => set({ manageToolData: data }),

    getConfig: async () => api.tools.listCustomServers(),

    saveConfig: async (config) => {
      await api.tools.replaceAllCustomServers(config.mcpServers);
      ctx.servers.setCustomServers(config);
      callbacksManager.emit("onServersUpdated", { kind: "config-saved" });
    },

    deleteCustomServer: async (name) => {
      await api.tools.removeCustomServer(name);
      ctx.servers.deleteCustomServer(name);
      callbacksManager.emit("onServersUpdated", {
        kind: "server-deleted",
        serverName: name,
      });
    },

    getCustomServersLogs: () => ctx.servers.getCustomServersLogs(),

    getWebSearchEnabled: () => api.webSearch.isConfigured(),
  }));
}
