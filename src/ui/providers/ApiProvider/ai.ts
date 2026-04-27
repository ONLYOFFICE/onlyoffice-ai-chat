import type { AIEngine, AIEngineMethod } from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type AIApi = {
  [K in AIEngineMethod]: (
    ...args: Parameters<AIEngine[K]>
  ) => ReturnType<AIEngine[K]>;
};

export function createAIApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): AIApi {
  return {
    send: (input) => callRoute(config, "ai", "send", [input], engines),
    sendCustom: (input) =>
      callRoute(config, "ai", "sendCustom", [input], engines),
    sendWithStream: (input) =>
      callRoute(config, "ai", "sendWithStream", [input], engines),
  };
}
