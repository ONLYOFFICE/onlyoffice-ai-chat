import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import type { CallbacksManager } from "../providers/EventsProvider";
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
  /**
   * Server-side "system" MCP tools, grouped by server type. Fetched in a
   * single call from `api.tools.listSystemTools` (the server already
   * connected and enumerated them) and rendered as permission cards
   * alongside custom servers. Not persisted in the MCP config, so they
   * never appear in the config editor and can't be deleted.
   */
  systemTools: Record<string, TMCPItem[]>;
  disabledTools: Record<string, string[]>;
  manageToolData?: {
    threadId: string;
    message: ThreadMessageLike;
    idx: number;
    messageId: string;
    /**
     * Set for server-executed system tools: the consumer must NOT run the
     * tool locally — approving just resumes the stream and the engine
     * executes it server-side.
     */
    serverExecuted?: boolean;
  };
  /**
   * `true` from the moment the user clicks "Allow" in the tool-confirmation
   * dialog until the tool result has been resolved (for server-executed
   * tools: the result emerges from the core stream). Drives the dialog's
   * pending state — it stays open and shows a loader instead of closing
   * instantly, so the host's `onToolCallApproveResult` callback can run
   * before the dialog dismisses.
   */
  isApprovingTool: boolean;
  setIsApprovingTool: (value: boolean) => void;
  webSearchEnabled: boolean;
  /**
   * `true` while the inline MCP config editor holds unsaved edits (the
   * document diverges from the last-loaded/saved config). Consumed by the
   * settings tab navigation to offer a discard confirmation before leaving
   * the MCP tab. Reset on save, close, or unmount of the editor.
   */
  mcpConfigDirty: boolean;
  setMcpConfigDirty: (dirty: boolean) => void;
  initServers: () => Promise<void>;
  getTools: () => Promise<void>;
  reload: () => Promise<void>;
  changeToolStatus: (
    type: string,
    name: string,
    enabled: boolean
  ) => Promise<void>;
  /**
   * Enable or disable every tool of a server type in one shot. A single
   * persist + state update — unlike calling {@link changeToolStatus} per
   * tool, which races (each call reads the same pre-update `disabledTools`
   * before its `await`, so only the last write survives).
   */
  changeAllToolStatus: (type: string, enabled: boolean) => Promise<void>;
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
  entityId?: string;
}): UseBoundStore<StoreApi<ServersStoreState>> {
  const { ctx, api, callbacksManager, entityId } = deps;

  const buildToolsList = async () => {
    const [grouped, systemTools, disabled, webSearchEnabled] =
      await Promise.all([
        ctx.servers.getTools(),
        // Single fetch — the server already connected + listed these.
        // Tolerate hosts that haven't wired the route yet.
        api.tools
          .listSystemTools(entityId)
          .catch(() => ({}) as Record<string, TMCPItem[]>),
        api.tools.getDisabled(entityId),
        api.webSearch.isConfigured(entityId),
      ]);

    // System tools join the same grouping so they get the disabled-flag
    // annotation and render as cards. Their server types are distinct
    // from custom/host keys.
    const groupedAll: Record<string, TMCPItem[]> = {
      ...grouped,
      ...systemTools,
    };

    // Annotate each tool with its `enabled` flag derived from the
    // persisted disabled list — used by the permissions UI to render
    // toggles.
    //
    // `flat` becomes `actionArgs.tools` (the client-executed "user" tools
    // the model is offered). The engine does NOT filter these by the
    // disabled map — it only knows the bare names, not the server grouping,
    // so `buildToolContext` passes `userTools` through as-is and expects the
    // caller to have pre-filtered. We therefore drop disabled tools from
    // `flat` here; skipping this is what let disabled MCP/host tools keep
    // working in chat.
    //
    // System tools are the exception: the engine injects and executes them
    // server-side via its adapter (and filters them by the same disabled
    // map there). They must NOT go into `flat` — that would re-classify them
    // as client-executed user tools, so the engine wouldn't flag them
    // `serverExecuted` and the browser would try (and fail) to run them
    // locally. They still appear in `servers` for the permission cards.
    const systemTypes = new Set(Object.keys(systemTools));
    const annotated: Record<string, TMCPItem[]> = {};
    const flat: TMCPItem[] = [];
    for (const [type, items] of Object.entries(groupedAll)) {
      const disabledForType = disabled[type] ?? [];
      annotated[type] = items.map((tool) => ({
        ...tool,
        enabled:
          tool.enabled !== undefined
            ? tool.enabled
            : !disabledForType.includes(tool.name),
      }));
      if (!systemTypes.has(type)) {
        flat.push(...annotated[type].filter((tool) => tool.enabled !== false));
      }
    }

    return {
      tools: flat,
      servers: annotated,
      systemTools,
      disabledTools: disabled,
      webSearchEnabled,
    };
  };

  return create<ServersStoreState>((set, get) => ({
    servers: {},
    tools: [],
    systemTools: {},
    disabledTools: {},
    manageToolData: undefined,
    isApprovingTool: false,
    webSearchEnabled: false,
    mcpConfigDirty: false,

    setMcpConfigDirty: (dirty) => set({ mcpConfigDirty: dirty }),

    initServers: async () => {
      // Reload the persisted MCP config from storage before starting —
      // otherwise a widget instance that didn't see the in-memory
      // `setCustomServers` (e.g. a chat mount that was created after the
      // settings dialog saved a new config in a different instance)
      // would run `startCustomServers` over an empty map and never spawn
      // anything. Re-reading from storage covers the cross-instance and
      // cold-start cases uniformly.
      const mcpServers = (await api.tools.listCustomServers(entityId)) ?? {};
      ctx.servers.setCustomServers({ mcpServers });
      ctx.servers.startCustomServers();
    },

    getTools: async () => {
      const result = await buildToolsList();
      set(result);
    },

    reload: async () => {
      const mcpServers = (await api.tools.listCustomServers(entityId)) ?? {};
      ctx.servers.setCustomServers({ mcpServers });
      ctx.servers.startCustomServers();
      const result = await buildToolsList();
      set(result);
    },

    changeToolStatus: async (type, name, enabled) => {
      const state = get();
      const current = state.disabledTools[type] ?? [];
      const next = enabled
        ? current.filter((n) => n !== name)
        : Array.from(new Set([...current, name]));
      await api.tools.setDisabled(type, next, entityId);

      // Optimistic local flip: just toggle `enabled` on the matching tool.
      // Avoids re-running `buildToolsList` (host getTools + getDisabled +
      // webSearch.isConfigured) on every checkbox click.
      const flip = (items: TMCPItem[]) =>
        items.map((tool) => (tool.name === name ? { ...tool, enabled } : tool));
      const nextServers =
        state.servers[type] !== undefined
          ? { ...state.servers, [type]: flip(state.servers[type]) }
          : state.servers;
      // Rebuild the flat `tools` payload as enabled-only (excluding system
      // tools, which never belong in `flat`). A plain in-place flip would
      // leave a just-disabled tool in the list — and re-enabling one that
      // was filtered out at build time could never add it back.
      const systemTypes = new Set(Object.keys(state.systemTools));
      const nextTools = Object.entries(nextServers)
        .filter(([t]) => !systemTypes.has(t))
        .flatMap(([, items]) =>
          items.filter((tool) => tool.enabled !== false)
        );

      set({
        servers: nextServers,
        tools: nextTools,
        disabledTools: { ...state.disabledTools, [type]: next },
      });

      callbacksManager.emit("onServersUpdated", {
        kind: "tool-toggled",
        toolType: type,
        toolName: name,
        enabled,
      });
    },

    changeAllToolStatus: async (type, enabled) => {
      const state = get();
      const items = state.servers[type] ?? [];
      if (items.length === 0) return;

      // The persisted disabled list for this type is empty when enabling
      // all, or every tool name when disabling all.
      const next = enabled ? [] : items.map((tool) => tool.name);
      await api.tools.setDisabled(type, next, entityId);

      const systemTypes = new Set(Object.keys(state.systemTools));
      const nextServers = {
        ...state.servers,
        [type]: items.map((tool) => ({ ...tool, enabled })),
      };
      const nextTools = Object.entries(nextServers)
        .filter(([t]) => !systemTypes.has(t))
        .flatMap(([, list]) =>
          list.filter((tool) => tool.enabled !== false)
        );

      set({
        servers: nextServers,
        tools: nextTools,
        disabledTools: { ...state.disabledTools, [type]: next },
      });

      // No `toolName` — a bulk toggle covers the whole server type.
      callbacksManager.emit("onServersUpdated", {
        kind: "tool-toggled",
        toolType: type,
        enabled,
      });
    },

    callTools: (name, args) => {
      const type = ctx.servers.getServerType(name);
      return ctx.servers.callTools(type, name, args);
    },

    setManageToolData: (data) => set({ manageToolData: data }),
    setIsApprovingTool: (value) => set({ isApprovingTool: value }),

    getConfig: async () => api.tools.listCustomServers(entityId),

    saveConfig: async (config) => {
      await api.tools.replaceAllCustomServers(config.mcpServers, entityId);
      ctx.servers.setCustomServers(config);
      ctx.servers.startCustomServers();
      callbacksManager.emit("onServersUpdated", { kind: "config-saved" });
    },

    deleteCustomServer: async (name) => {
      await api.tools.removeCustomServer(name, entityId);
      ctx.servers.deleteCustomServer(name);
      callbacksManager.emit("onServersUpdated", {
        kind: "server-deleted",
        serverName: name,
      });
    },

    getCustomServersLogs: () => ctx.servers.getCustomServersLogs(),

    getWebSearchEnabled: () => api.webSearch.isConfigured(entityId),
  }));
}
