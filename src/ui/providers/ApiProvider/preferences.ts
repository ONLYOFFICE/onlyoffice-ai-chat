import type {
  PreferencesEngine,
  PreferencesEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type PreferencesApi = {
  [K in PreferencesEngineMethod]: (
    ...args: Parameters<PreferencesEngine[K]>
  ) => ReturnType<PreferencesEngine[K]>;
};

export function createPreferencesApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): PreferencesApi {
  return {
    getDeepMode: (entityId) =>
      callRoute(config, "preferences", "getDeepMode", [entityId], engines),
    setDeepMode: (value, entityId) =>
      callRoute(
        config,
        "preferences",
        "setDeepMode",
        [value, entityId],
        engines
      ),
    clearDeepMode: (entityId) =>
      callRoute(config, "preferences", "clearDeepMode", [entityId], engines),
    isDeepModeSet: (entityId) =>
      callRoute(config, "preferences", "isDeepModeSet", [entityId], engines),
    getReasoningLevel: (entityId) =>
      callRoute(
        config,
        "preferences",
        "getReasoningLevel",
        [entityId],
        engines
      ),
    setReasoningLevel: (value, entityId) =>
      callRoute(
        config,
        "preferences",
        "setReasoningLevel",
        [value, entityId],
        engines
      ),
    getToolPermissionMode: (entityId) =>
      callRoute(
        config,
        "preferences",
        "getToolPermissionMode",
        [entityId],
        engines
      ),
    setToolPermissionMode: (value, entityId) =>
      callRoute(
        config,
        "preferences",
        "setToolPermissionMode",
        [value, entityId],
        engines
      ),
  };
}
