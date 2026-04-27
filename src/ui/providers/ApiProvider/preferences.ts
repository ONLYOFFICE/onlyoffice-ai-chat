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
    getDeepMode: () =>
      callRoute(config, "preferences", "getDeepMode", [], engines),
    setDeepMode: (value) =>
      callRoute(config, "preferences", "setDeepMode", [value], engines),
    clearDeepMode: () =>
      callRoute(config, "preferences", "clearDeepMode", [], engines),
    isDeepModeSet: () =>
      callRoute(config, "preferences", "isDeepModeSet", [], engines),
  };
}
