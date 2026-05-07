import type {
  WebSearchEngineMethod,
  WebSearchEngine,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type WebSearchApi = {
  [K in WebSearchEngineMethod]: (
    ...args: Parameters<WebSearchEngine[K]>
  ) => ReturnType<WebSearchEngine[K]>;
};

export function createWebSearchApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): WebSearchApi {
  return {
    getActiveConfig: (entityId) =>
      callRoute(config, "webSearch", "getActiveConfig", [entityId], engines),
    isConfigured: (entityId) =>
      callRoute(config, "webSearch", "isConfigured", [entityId], engines),
    testConnection: (body) =>
      callRoute(config, "webSearch", "testConnection", [body], engines),
    configure: (body, entityId) =>
      callRoute(config, "webSearch", "configure", [body, entityId], engines),
    setActiveConfig: (body, entityId) =>
      callRoute(
        config,
        "webSearch",
        "setActiveConfig",
        [body, entityId],
        engines
      ),
    clear: (entityId) =>
      callRoute(config, "webSearch", "clear", [entityId], engines),
  };
}
