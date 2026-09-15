import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { PromptHistoryEngine } from "./engine";

/** Public method names exposed by {@link PromptHistoryEngine}. */
export type PromptHistoryEngineMethod = {
  [K in keyof PromptHistoryEngine]: PromptHistoryEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof PromptHistoryEngine];

/**
 * Default HTTP method + URL path for each {@link PromptHistoryEngine}
 * method. Paths are relative to the host's API base URL (no leading
 * slash).
 */
export const DEFAULT_PROMPT_HISTORY_ROUTES: Record<
  PromptHistoryEngineMethod,
  RouteSpec
> = {
  list: {
    method: "GET",
    path: "prompt-history/list",
    params: ["scopeId", "limit"],
  },
  record: { method: "POST", path: "prompt-history/record" },
  clear: { method: "DELETE", path: "prompt-history/clear" },
};

/** Dependencies injected into a {@link PromptHistoryEngine} instance. */
export type PromptHistoryEngineDeps = {
  storage: StorageAdapter;
};

/**
 * How many entries the engine keeps per scope. Old entries fall off the
 * front once the cap is exceeded — the history is a convenience, not an
 * archive, and an unbounded list would grow without limit in a document
 * someone works in every day.
 */
export const PROMPT_HISTORY_LIMIT = 100;
