import type { TErrorData } from "../../../shared/error-data";
import type { Profile } from "../../types";
import type { StorageAdapter } from "../../storage";
import type { AssignmentsEngine } from "../assignments";
import type { RouteSpec } from "../types";
import type { ProfilesEngine } from "./engine";

/** Public method names exposed by {@link ProfilesEngine}. */
export type ProfilesEngineMethod = {
  [K in keyof ProfilesEngine]: ProfilesEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof ProfilesEngine];

/**
 * Default HTTP method + URL path for each {@link ProfilesEngine}
 * method. Paths are relative to the host's API base URL (no leading
 * slash).
 */
export const DEFAULT_PROFILES_ROUTES: Record<ProfilesEngineMethod, RouteSpec> =
  {
    create: { method: "POST", path: "profiles/create" },
    update: { method: "PUT", path: "profiles/update" },
    delete: { method: "DELETE", path: "profiles/delete" },
    listModels: {
      method: "GET",
      path: "profiles/list-models",
      params: ["profileId"],
    },
    listProviderModels: {
      method: "POST",
      path: "profiles/list-provider-models",
    },
    testConnection: { method: "POST", path: "profiles/test-connection" },
    getById: { method: "GET", path: "profiles/get-by-id", params: ["id"] },
    list: { method: "GET", path: "profiles/list" },
  };

/**
 * Dependencies injected into a {@link ProfilesEngine} instance.
 *
 * `assignments` is optional — the engine constructs its own from
 * `storage` when omitted. Pass your own when you want to share a
 * single sub-engine instance across `ProfilesEngine` and `AIEngine`.
 */
export type ProfilesEngineDeps = {
  storage: StorageAdapter;
  assignments?: AssignmentsEngine;
};

/**
 * Input for creating a new profile — the same shape as {@link Profile}
 * without the engine-generated fields (`id`, `createdAt`).
 */
export type CreateProfileInput = Omit<Profile, "id" | "createdAt">;

/**
 * Outcome of `create` / `update` — either a success carrying the
 * persisted profile, or a failure with a field-level error description
 * from the name check or the provider credential check.
 */
export type ProfileMutationResult =
  | { success: true; profile: Profile }
  | { success: false; error: TErrorData };
