import type { TErrorData } from "../../../shared/error-data";
import type { StorageAdapter, WebSearchConfig } from "../../storage";
import type { RouteSpec } from "../types";
import type { WebSearchEngine } from "./engine";

/** Public method names exposed by {@link WebSearchEngine}. */
export type WebSearchEngineMethod = {
  [K in keyof WebSearchEngine]: WebSearchEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof WebSearchEngine];

/**
 * Default HTTP method + URL path for each {@link WebSearchEngine}
 * method. Paths are relative to the host's API base URL (no leading
 * slash).
 */
export const DEFAULT_WEB_SEARCH_ROUTES: Record<
  WebSearchEngineMethod,
  RouteSpec
> = {
  getActiveConfig: { method: "GET", path: "web-search/get-active-config" },
  isConfigured: { method: "GET", path: "web-search/is-configured" },
  testConnection: { method: "POST", path: "web-search/test-connection" },
  configure: { method: "PUT", path: "web-search/configure" },
  setActiveConfig: { method: "PUT", path: "web-search/set-active-config" },
  clear: { method: "DELETE", path: "web-search/clear" },
};

/** Dependencies injected into a {@link WebSearchEngine} instance. */
export type WebSearchEngineDeps = {
  storage: StorageAdapter;
};

/**
 * Outcome of {@link WebSearchEngine.configure} — either the persisted
 * config or a field-scoped error suitable for the settings form.
 */
export type WebSearchMutationResult =
  | { success: true; config: WebSearchConfig }
  | { success: false; error: TErrorData };

export type { WebSearchConfig };
