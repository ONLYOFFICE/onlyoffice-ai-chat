import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import type { CallbacksManager } from "../providers/EventsProvider";
import type { ServerAPI } from "../providers/ApiProvider";
import type { TMCPItem } from "../../types";
import type { TSystemToolsListing } from "../../core/services";
import {
  DEFAULT_TOOL_PERMISSION_MODE,
  type ToolPermissionMode,
} from "../../shared/tool-permission-mode";
import logger from "../../shared/logger";
import { isRouteUnavailable } from "../providers/ApiProvider/fetcher";
import { reportStoreError } from "./report-error";

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
  /**
   * Names of the registered custom MCP servers with a startable config,
   * straight from `api.tools.listCustomServers`. In hosts whose backend
   * executes the servers (`PlatformAdapter.customServersExecutedByHost`)
   * the local server map stays empty, so this is what lets the permission
   * list show a loading card for each registered server before its tools
   * arrive via `listSystemTools`.
   */
  registeredServers: string[];
  /**
   * Per-server enumeration failure messages from the system-tools listing
   * (`listSystemTools` new `{ groups, errors }` shape): why a server-executed
   * MCP server delivered no tools. Empty for hosts on the legacy shape.
   */
  systemToolsErrors: Record<string, string>;
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
   * How a tool call the model makes is approved — the composer's
   * "Permissions" row. Read from the host on init; a host without the
   * route keeps the default.
   */
  toolPermissionMode: ToolPermissionMode;
  setToolPermissionMode: (mode: ToolPermissionMode) => Promise<void>;
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
  /**
   * The client-executed tool list for the next chat round, assembled
   * locally with no API round trip and tagged with each tool's
   * `serverType` so the engine can apply the persisted disabled map
   * itself. Used by the send / regenerate paths in place of a pre-send
   * {@link getTools} refresh.
   */
  getUserTools: () => Promise<TMCPItem[]>;
  /**
   * Per-server MCP `initialize` instructions for the next chat round,
   * keyed by server type — shipped as `actionArgs.toolInstructions` so
   * the engine can fold them into the system prompt.
   *
   * Read straight from the live aggregator with no API round trip, and
   * deliberately not filtered by the disabled map: the engine drops the
   * notes of a server that contributed no tool, which keeps the filtering
   * decision in the one place that always sees the current map.
   */
  getToolInstructions: () => Record<string, string>;
  reload: () => Promise<void>;
  /**
   * Enable or disable one tool — or several of the same server type in one
   * atomic persist + state update by passing an array of names. Passing an
   * array is required when toggling tools together (e.g. the web-search
   * pair): calling this once per tool races, since each call reads the same
   * pre-update `disabledTools` before its `await` and only the last write
   * survives.
   */
  changeToolStatus: (
    type: string,
    name: string | string[],
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
  getEntityId?: () => string | undefined;
}): UseBoundStore<StoreApi<ServersStoreState>> {
  const { ctx, api, callbacksManager, getEntityId } = deps;
  const entity = () => getEntityId?.();

  // Reload the persisted MCP config from storage before starting — otherwise
  // a widget instance that didn't see the in-memory `setCustomServers` (e.g. a
  // chat mount created after the settings dialog saved a new config in a
  // different instance) would run `startCustomServers` over an empty map and
  // never spawn anything. Re-reading from storage covers the cross-instance
  // and cold-start cases uniformly.
  const loadAndStartCustomServers = async (): Promise<string[]> => {
    const mcpServers = (await api.tools.listCustomServers(entity())) ?? {};
    ctx.servers.setCustomServers({ mcpServers });
    ctx.servers.startCustomServers();
    // Startable entries only: whitelist markers for system servers come
    // back with their config redacted to `{}` and must not produce a
    // pending card of their own (their group renders from `systemTools`).
    return Object.entries(mcpServers)
      .filter(
        ([, config]) =>
          typeof (config as { url?: unknown }).url === "string" ||
          typeof (config as { command?: unknown }).command === "string"
      )
      .map(([name]) => name);
  };

  // `listSystemTools` answers in one of two shapes (see TSystemToolsListing):
  // the legacy grouped map, or `{ groups, errors }` where `errors` says why
  // a server delivered no tools. Normalize to the pair.
  const normalizeSystemListing = (
    raw: TSystemToolsListing
  ): {
    groups: Record<string, TMCPItem[]>;
    errors: Record<string, string>;
  } => {
    if (
      raw &&
      typeof raw === "object" &&
      "groups" in raw &&
      "errors" in raw &&
      !Array.isArray((raw as { groups: unknown }).groups)
    ) {
      const shaped = raw as {
        groups: Record<string, TMCPItem[]>;
        errors: Record<string, string>;
      };
      return { groups: shaped.groups ?? {}, errors: shaped.errors ?? {} };
    }
    return { groups: (raw as Record<string, TMCPItem[]>) ?? {}, errors: {} };
  };

  const buildToolsList = async () => {
    const [grouped, systemListing, disabled, webSearchEnabled] =
      await Promise.all([
        ctx.servers.getTools(),
        // Single fetch — the server already connected + listed these.
        // Tolerate hosts that haven't wired the route yet.
        api.tools
          .listSystemTools(entity())
          .catch(() => ({}) as TSystemToolsListing),
        api.tools.getDisabled(entity()),
        api.webSearch.isConfigured(entity()),
      ]);
    const { groups: systemTools, errors: systemToolsErrors } =
      normalizeSystemListing(systemListing);

    // System tools join the same grouping so they get the disabled-flag
    // annotation and render as cards. Their server types are distinct
    // from custom/host keys.
    const groupedAll: Record<string, TMCPItem[]> = {
      ...grouped,
      ...systemTools,
    };

    // Annotate each tool with its `serverType` and with the `enabled` flag
    // derived from the persisted disabled list — the permissions UI renders
    // its toggles from both.
    //
    // `flat` (the store's `tools`) is the enabled-only view: the tools
    // counter sizes itself on it and the resume rounds (approve / deny)
    // ship it as `actionArgs.tools`. The send path does NOT read it — it
    // calls `getUserTools()`, which skips this fetch entirely and leaves
    // the disabled filtering to the engine, the one place that always
    // sees the current map.
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
        serverType: type,
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
      systemToolsErrors,
      disabledTools: disabled,
      webSearchEnabled,
    };
  };

  /**
   * Assemble the client-executed tool list for one chat round without an
   * API call — the send path must not pay a round trip for it. Waits for
   * the configured MCP servers to finish connecting (bounded inside
   * `waitUntilCustomServersReady`, so a hung server can't block a send)
   * so the first message after a mount still carries their tools, then
   * flattens the live grouping and tags every tool with its `serverType`.
   *
   * Deliberately NOT filtered by the persisted disabled map: the engine
   * applies it in `buildToolContext`, which keeps one authority and makes
   * a toggle flipped elsewhere (another tab, the settings page) take
   * effect on the very next round — in both directions. Server-side
   * "system" tools cannot leak in here: they only ever come from
   * `api.tools.listSystemTools`, never from the live aggregator.
   */
  const buildUserTools = async (): Promise<TMCPItem[]> => {
    await ctx.servers.waitUntilCustomServersReady();
    const grouped = await ctx.servers.getTools();
    return Object.entries(grouped).flatMap(([serverType, items]) =>
      items.map((tool) => ({ ...tool, serverType }))
    );
  };

  // A host built before the mode existed answers the route with a 404:
  // keep the default and stop asking for the rest of this store's life.
  // A transient failure is rethrown like any other, so a flaky network
  // never downgrades the host.
  let modeRouteMissing = false;
  const readMode = async (): Promise<ToolPermissionMode | null> => {
    if (modeRouteMissing) return null;
    try {
      return await api.preferences.getToolPermissionMode(entity());
    } catch (error) {
      if (!isRouteUnavailable(error)) throw error;
      modeRouteMissing = true;
      logger.warn(
        "Tool permission mode is not served by the host; keeping the default:",
        error
      );
      return null;
    }
  };
  const writeMode = async (mode: ToolPermissionMode): Promise<void> => {
    if (modeRouteMissing) return;
    try {
      await api.preferences.setToolPermissionMode(mode, entity());
    } catch (error) {
      if (!isRouteUnavailable(error)) throw error;
      modeRouteMissing = true;
      logger.warn(
        "Tool permission mode is not served by the host; keeping it in memory only:",
        error
      );
    }
  };
  // Never lets a failed read hold up the servers it is loaded next to:
  // the mode keeps its last value and the failure is only logged.
  const loadMode = async () => {
    try {
      const mode = await readMode();
      if (mode !== null) store.setState({ toolPermissionMode: mode });
    } catch (error) {
      logger.error("Failed to read the tool permission mode:", error);
    }
  };

  // Coalesces concurrent `getTools()` calls (mount + `tools-changed` bursts
  // as MCP servers connect), each of which fans out to three reads. While one run is active, extra calls flag a
  // single trailing re-run so the final state still reflects the latest
  // tools (an MCP server that connected mid-run) without a fetch per event.
  let toolsInFlight: Promise<void> | null = null;
  let toolsDirty = false;

  const store = create<ServersStoreState>((set, get) => ({
    servers: {},
    tools: [],
    systemTools: {},
    systemToolsErrors: {},
    registeredServers: [],
    disabledTools: {},
    manageToolData: undefined,
    isApprovingTool: false,
    webSearchEnabled: false,
    toolPermissionMode: DEFAULT_TOOL_PERMISSION_MODE,
    mcpConfigDirty: false,

    setMcpConfigDirty: (dirty) => set({ mcpConfigDirty: dirty }),

    initServers: async () => {
      // Called without an await from the mount effects (`useServers`,
      // `useEnsureTools`) — see `reportStoreError`.
      try {
        const [registeredServers] = await Promise.all([
          loadAndStartCustomServers(),
          loadMode(),
        ]);
        set({ registeredServers });
      } catch (error) {
        reportStoreError(callbacksManager, "servers:init", error);
      }
    },

    getTools: () => {
      if (toolsInFlight) {
        toolsDirty = true;
        return toolsInFlight;
      }
      toolsInFlight = (async () => {
        try {
          do {
            toolsDirty = false;
            const result = await buildToolsList();
            set(result);
          } while (toolsDirty);
        } catch (error) {
          // Called without an await from the mount effects and from the
          // `tools-changed` bus handler — see `reportStoreError`. The last
          // known tool list stays in place.
          reportStoreError(callbacksManager, "tools:list", error);
        } finally {
          toolsInFlight = null;
        }
      })();
      return toolsInFlight;
    },

    getUserTools: () => buildUserTools(),

    getToolInstructions: () => ctx.servers.getToolInstructions(),

    reload: async () => {
      const [registeredServers] = await Promise.all([
        loadAndStartCustomServers(),
        loadMode(),
      ]);
      set({ registeredServers });
      const result = await buildToolsList();
      set(result);
    },

    setToolPermissionMode: async (mode) => {
      await writeMode(mode);
      set({ toolPermissionMode: mode });
    },

    changeToolStatus: async (type, name, enabled) => {
      const names = Array.isArray(name) ? name : [name];
      const state = get();
      const current = state.disabledTools[type] ?? [];
      const next = enabled
        ? current.filter((n) => !names.includes(n))
        : Array.from(new Set([...current, ...names]));
      await api.tools.setDisabled(type, next, entity());

      // Optimistic local flip: just toggle `enabled` on the matching tools.
      // Avoids re-running `buildToolsList` (host getTools + getDisabled +
      // webSearch.isConfigured) on every checkbox click.
      const flip = (items: TMCPItem[]) =>
        items.map((tool) =>
          names.includes(tool.name) ? { ...tool, enabled } : tool
        );
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
        .flatMap(([, items]) => items.filter((tool) => tool.enabled !== false));

      set({
        servers: nextServers,
        tools: nextTools,
        disabledTools: { ...state.disabledTools, [type]: next },
      });

      callbacksManager.emit("onServersUpdated", {
        kind: "tool-toggled",
        toolType: type,
        // Omit `toolName` for a multi-tool flip — the event carries a single
        // name only when exactly one tool changed.
        ...(names.length === 1 ? { toolName: names[0] } : {}),
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
      await api.tools.setDisabled(type, next, entity());

      const systemTypes = new Set(Object.keys(state.systemTools));
      const nextServers = {
        ...state.servers,
        [type]: items.map((tool) => ({ ...tool, enabled })),
      };
      const nextTools = Object.entries(nextServers)
        .filter(([t]) => !systemTypes.has(t))
        .flatMap(([, list]) => list.filter((tool) => tool.enabled !== false));

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

    getConfig: async () => api.tools.listCustomServers(entity()),

    saveConfig: async (config) => {
      await api.tools.replaceAllCustomServers(config.mcpServers, entity());
      ctx.servers.setCustomServers(config);
      ctx.servers.startCustomServers();
      // Re-read from storage rather than trusting the submitted map: the
      // backend normalizes it (drops invalid entries, redacts system
      // markers), and the pending cards must reflect what was stored.
      try {
        set({ registeredServers: await loadAndStartCustomServers() });
      } catch {
        // keep the previous list — the config itself was saved
      }
      callbacksManager.emit("onServersUpdated", { kind: "config-saved" });
    },

    deleteCustomServer: async (name) => {
      await api.tools.removeCustomServer(name, entity());
      ctx.servers.deleteCustomServer(name);
      set((state) => ({
        registeredServers: state.registeredServers.filter((n) => n !== name),
      }));
      callbacksManager.emit("onServersUpdated", {
        kind: "server-deleted",
        serverName: name,
      });
    },

    getCustomServersLogs: () => ctx.servers.getCustomServersLogs(),

    getWebSearchEnabled: () => api.webSearch.isConfigured(entity()),
  }));

  return store;
}
