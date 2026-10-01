import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { ContextEngine } from "./engine";

/** Public method names exposed by {@link ContextEngine}. */
export type ContextEngineMethod = {
  [K in keyof ContextEngine]: ContextEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof ContextEngine];

/**
 * Default HTTP method + URL path for each {@link ContextEngine} method.
 * Paths are relative to the host's API base URL (no leading slash).
 */
export const DEFAULT_CONTEXT_ROUTES: Record<ContextEngineMethod, RouteSpec> = {
  getContextFolders: { method: "GET", path: "context/get-context-folders" },
  getRoomSkills: {
    method: "GET",
    path: "context/get-room-skills",
    params: ["cloud", "roomId"],
  },
  getRoomSkill: {
    method: "GET",
    path: "context/get-room-skill",
    params: ["cloud", "roomId", "skillId"],
  },
};

/** Dependencies injected into a {@link ContextEngine} instance. */
export type ContextEngineDeps = {
  storage: StorageAdapter;
};
