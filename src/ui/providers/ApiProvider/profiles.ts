import type {
  ProfilesEngine,
  ProfilesEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type ProfilesApi = {
  [K in ProfilesEngineMethod]: (
    ...args: Parameters<ProfilesEngine[K]>
  ) => ReturnType<ProfilesEngine[K]>;
};

export function createProfilesApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): ProfilesApi {
  return {
    create: (input) =>
      callRoute(config, "profiles", "create", [input], engines),
    update: (profile) =>
      callRoute(config, "profiles", "update", [profile], engines),
    delete: (id) => callRoute(config, "profiles", "delete", [id], engines),
    listModels: (profileId) =>
      callRoute(config, "profiles", "listModels", [profileId], engines),
    listProviderModels: (input) =>
      callRoute(config, "profiles", "listProviderModels", [input], engines),
    testConnection: (profileId) =>
      callRoute(config, "profiles", "testConnection", [profileId], engines),
    getById: (id) => callRoute(config, "profiles", "getById", [id], engines),
    list: () => callRoute(config, "profiles", "list", [], engines),
  };
}
