import type { ToolsEngine, ToolsEngineMethod } from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type ToolsApi = {
  [K in ToolsEngineMethod]: (
    ...args: Parameters<ToolsEngine[K]>
  ) => ReturnType<ToolsEngine[K]>;
};

export function createToolsApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): ToolsApi {
  return {
    addCustomServer: (name, serverConfig, entityId) =>
      callRoute(
        config,
        "tools",
        "addCustomServer",
        [name, serverConfig, entityId],
        engines
      ),
    updateCustomServer: (name, serverConfig, entityId) =>
      callRoute(
        config,
        "tools",
        "updateCustomServer",
        [name, serverConfig, entityId],
        engines
      ),
    removeCustomServer: (name, entityId) =>
      callRoute(
        config,
        "tools",
        "removeCustomServer",
        [name, entityId],
        engines
      ),
    getCustomServer: (name, entityId) =>
      callRoute(config, "tools", "getCustomServer", [name, entityId], engines),
    listCustomServers: (entityId) =>
      callRoute(config, "tools", "listCustomServers", [entityId], engines),
    listSystemTools: (entityId) =>
      callRoute(config, "tools", "listSystemTools", [entityId], engines),
    replaceAllCustomServers: (map, entityId) =>
      callRoute(
        config,
        "tools",
        "replaceAllCustomServers",
        [map, entityId],
        engines
      ),
    setDisabled: (serverType, toolNames, entityId) =>
      callRoute(
        config,
        "tools",
        "setDisabled",
        [serverType, toolNames, entityId],
        engines
      ),
    getDisabled: (entityId) =>
      callRoute(config, "tools", "getDisabled", [entityId], engines),
    isToolDisabled: (serverType, toolName, entityId) =>
      callRoute(
        config,
        "tools",
        "isToolDisabled",
        [serverType, toolName, entityId],
        engines
      ),
    setAllowAlways: (serverType, toolName, value, entityId) =>
      callRoute(
        config,
        "tools",
        "setAllowAlways",
        [serverType, toolName, value, entityId],
        engines
      ),
    getAllowAlways: (entityId) =>
      callRoute(config, "tools", "getAllowAlways", [entityId], engines),
    isAllowAlways: (serverType, toolName, entityId) =>
      callRoute(
        config,
        "tools",
        "isAllowAlways",
        [serverType, toolName, entityId],
        engines
      ),
  };
}
