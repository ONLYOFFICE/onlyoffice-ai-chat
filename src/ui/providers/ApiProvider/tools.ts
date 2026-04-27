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
    addCustomServer: (name, serverConfig) =>
      callRoute(
        config,
        "tools",
        "addCustomServer",
        [name, serverConfig],
        engines
      ),
    updateCustomServer: (name, serverConfig) =>
      callRoute(
        config,
        "tools",
        "updateCustomServer",
        [name, serverConfig],
        engines
      ),
    removeCustomServer: (name) =>
      callRoute(config, "tools", "removeCustomServer", [name], engines),
    getCustomServer: (name) =>
      callRoute(config, "tools", "getCustomServer", [name], engines),
    listCustomServers: () =>
      callRoute(config, "tools", "listCustomServers", [], engines),
    replaceAllCustomServers: (map) =>
      callRoute(config, "tools", "replaceAllCustomServers", [map], engines),
    setDisabled: (serverType, toolNames) =>
      callRoute(
        config,
        "tools",
        "setDisabled",
        [serverType, toolNames],
        engines
      ),
    getDisabled: () => callRoute(config, "tools", "getDisabled", [], engines),
    isToolDisabled: (serverType, toolName) =>
      callRoute(
        config,
        "tools",
        "isToolDisabled",
        [serverType, toolName],
        engines
      ),
    setAllowAlways: (serverType, toolName, value) =>
      callRoute(
        config,
        "tools",
        "setAllowAlways",
        [serverType, toolName, value],
        engines
      ),
    getAllowAlways: () =>
      callRoute(config, "tools", "getAllowAlways", [], engines),
    isAllowAlways: (serverType, toolName) =>
      callRoute(
        config,
        "tools",
        "isAllowAlways",
        [serverType, toolName],
        engines
      ),
  };
}
