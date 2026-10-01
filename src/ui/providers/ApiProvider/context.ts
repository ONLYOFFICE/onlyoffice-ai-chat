import type {
  ContextEngine,
  ContextEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type ContextApi = {
  [K in ContextEngineMethod]: (
    ...args: Parameters<ContextEngine[K]>
  ) => ReturnType<ContextEngine[K]>;
};

export function createContextApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): ContextApi {
  return {
    getContextFolders: () =>
      callRoute(config, "context", "getContextFolders", [], engines),
    getRoomSkills: (cloud, roomId) =>
      callRoute(config, "context", "getRoomSkills", [cloud, roomId], engines),
    getRoomSkill: (cloud, roomId, skillId) =>
      callRoute(
        config,
        "context",
        "getRoomSkill",
        [cloud, roomId, skillId],
        engines
      ),
  };
}
