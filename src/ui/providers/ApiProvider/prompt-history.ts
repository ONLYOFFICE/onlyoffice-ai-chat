import type {
  PromptHistoryEngine,
  PromptHistoryEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type PromptHistoryApi = {
  [K in PromptHistoryEngineMethod]: (
    ...args: Parameters<PromptHistoryEngine[K]>
  ) => ReturnType<PromptHistoryEngine[K]>;
};

export function createPromptHistoryApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): PromptHistoryApi {
  return {
    list: (scopeId, limit) =>
      callRoute(config, "promptHistory", "list", [scopeId, limit], engines),
    record: (text, scopeId) =>
      callRoute(config, "promptHistory", "record", [text, scopeId], engines),
    clear: (scopeId) =>
      callRoute(config, "promptHistory", "clear", [scopeId], engines),
  };
}
