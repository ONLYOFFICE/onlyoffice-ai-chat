import type { TErrorData } from "../../../shared/error-data";
import type { McpServerConfig } from "../../storage";
import type { StorageAdapter } from "../../storage";
import type { ToolsAdapter } from "../../tools-adapter";
import type { RouteSpec } from "../types";
import type { ToolsEngine } from "./engine";

/** Public method names exposed by {@link ToolsEngine}. */
export type ToolsEngineMethod = {
  [K in keyof ToolsEngine]: ToolsEngine[K] extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof ToolsEngine];

/**
 * Default HTTP method + URL path for each {@link ToolsEngine} method.
 * Paths are relative to the host's API base URL (no leading slash).
 */
export const DEFAULT_TOOLS_ROUTES: Record<ToolsEngineMethod, RouteSpec> = {
  addCustomServer: { method: "POST", path: "tools/add-custom-server" },
  updateCustomServer: { method: "PUT", path: "tools/update-custom-server" },
  removeCustomServer: {
    method: "DELETE",
    path: "tools/remove-custom-server",
  },
  getCustomServer: {
    method: "GET",
    path: "tools/get-custom-server",
    params: ["name", "entityId"],
  },
  listCustomServers: {
    method: "GET",
    path: "tools/list-custom-servers",
    params: ["entityId"],
  },
  listSystemTools: {
    method: "GET",
    path: "tools/list-system-tools",
    params: ["entityId"],
  },
  replaceAllCustomServers: {
    method: "PUT",
    path: "tools/replace-all-custom-servers",
  },
  setDisabled: { method: "PUT", path: "tools/set-disabled" },
  getDisabled: {
    method: "GET",
    path: "tools/get-disabled",
    params: ["entityId"],
  },
  isToolDisabled: {
    method: "GET",
    path: "tools/is-tool-disabled",
    params: ["serverType", "toolName", "entityId"],
  },
  setAllowAlways: { method: "PUT", path: "tools/set-allow-always" },
  getAllowAlways: {
    method: "GET",
    path: "tools/get-allow-always",
    params: ["entityId"],
  },
  isAllowAlways: {
    method: "GET",
    path: "tools/is-allow-always",
    params: ["serverType", "toolName", "entityId"],
  },
};

/** Dependencies injected into a {@link ToolsEngine} instance. */
export type ToolsEngineDeps = {
  storage: StorageAdapter;

  /**
   * Optional server-side system tool source (the same instance wired
   * into `AIEngineDeps.toolsAdapter`). Exposes the host-configured
   * "system" MCP servers' tools to the client via
   * {@link ToolsEngine.listSystemTools} — one fetch, already enumerated
   * server-side — for rendering the permission cards. Never touches
   * `storage.mcpServers`, so these stay out of the config editor and
   * can't be deleted.
   */
  systemToolsSource?: Pick<ToolsAdapter, "getTools">;
};

/**
 * Outcome of an MCP-server CRUD call. Either success or a
 * field-scoped error suitable for the settings form.
 */
export type ToolsMutationResult =
  | { success: true }
  | { success: false; error: TErrorData };

/**
 * Outcome of {@link ToolsEngine.replaceAllCustomServers} — either
 * every entry persisted, or no entries persisted plus a per-key
 * error report.
 */
export type ToolsBulkResult =
  | { success: true }
  | {
      success: false;
      errors: Array<{ name: string; error: TErrorData }>;
    };

/**
 * Discriminated union of supported MCP transport shapes. The
 * concrete `McpServerConfig` is intentionally a loose
 * `Record<string, unknown>` at the storage layer; the engine
 * narrows it to one of these on validation.
 */
export type McpTransportConfig =
  | {
      url: string;
      headers?: Record<string, string>;
    }
  | {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };

export type { McpServerConfig };
