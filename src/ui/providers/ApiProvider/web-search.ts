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
    getActiveConfig: () =>
      callRoute(config, "webSearch", "getActiveConfig", [], engines),
    isConfigured: () =>
      callRoute(config, "webSearch", "isConfigured", [], engines),
    testConnection: (body) =>
      callRoute(config, "webSearch", "testConnection", [body], engines),
    configure: (body) =>
      callRoute(config, "webSearch", "configure", [body], engines),
    setActiveConfig: (body) =>
      callRoute(config, "webSearch", "setActiveConfig", [body], engines),
    clear: () => callRoute(config, "webSearch", "clear", [], engines),
  };
}
