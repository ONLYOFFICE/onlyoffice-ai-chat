import {
  DEFAULT_REASONING_LEVEL,
  type ReasoningLevel,
} from "../../../shared/reasoning-level";
import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { PreferencesEngine } from "./engine";

/** Public method names exposed by {@link PreferencesEngine}. */
export type PreferencesEngineMethod = {
  [K in keyof PreferencesEngine]: PreferencesEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof PreferencesEngine];

/**
 * Default HTTP method + URL path for each {@link PreferencesEngine}
 * method. Paths are relative to the host's API base URL (no leading
 * slash).
 */
export const DEFAULT_PREFERENCES_ROUTES: Record<
  PreferencesEngineMethod,
  RouteSpec
> = {
  getDeepMode: {
    method: "GET",
    path: "preferences/get-deep-mode",
    params: ["entityId"],
  },
  setDeepMode: { method: "PUT", path: "preferences/set-deep-mode" },
  clearDeepMode: { method: "DELETE", path: "preferences/clear-deep-mode" },
  isDeepModeSet: {
    method: "GET",
    path: "preferences/is-deep-mode-set",
    params: ["entityId"],
  },
  getReasoningLevel: {
    method: "GET",
    path: "preferences/get-reasoning-level",
    params: ["entityId"],
  },
  setReasoningLevel: {
    method: "PUT",
    path: "preferences/set-reasoning-level",
  },
};

/** Dependencies injected into a {@link PreferencesEngine} instance. */
export type PreferencesEngineDeps = {
  storage: StorageAdapter;
};

/**
 * Application-wide defaults applied by {@link PreferencesEngine} when
 * a preference has never been persisted (`storage.preferences.read*()`
 * returns `null`).
 *
 * Override by passing a partial map into the engine constructor —
 * unspecified keys keep the built-in default.
 */
export type PreferenceDefaults = {
  /** Default value of the deep-mode (extended-thinking) toggle. */
  deepMode: boolean;
  /**
   * Depth used while deep mode is on and no depth has been persisted —
   * also what the legacy boolean toggle alone stands for.
   */
  reasoningLevel: Exclude<ReasoningLevel, "off">;
};

/** Built-in defaults — read by the engine when none are passed. */
export const DEFAULT_PREFERENCES: PreferenceDefaults = {
  deepMode: false,
  reasoningLevel: DEFAULT_REASONING_LEVEL,
};
