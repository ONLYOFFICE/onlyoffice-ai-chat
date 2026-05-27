import type { ActionType } from "../../../shared/action-type";
import type { TErrorData } from "../../../shared/error-data";
import type { Profile } from "../../types";
import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { AssignmentsEngine } from "./engine";

/** Public method names exposed by {@link AssignmentsEngine}. */
export type AssignmentsEngineMethod = {
  [K in keyof AssignmentsEngine]: AssignmentsEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof AssignmentsEngine];

/**
 * Default HTTP method + URL path for each {@link AssignmentsEngine}
 * method. Paths are relative to the host's API base URL (no leading
 * slash).
 */
export const DEFAULT_ASSIGNMENTS_ROUTES: Record<
  AssignmentsEngineMethod,
  RouteSpec
> = {
  resolveForAction: {
    method: "GET",
    path: "assignments/resolve-for-action",
    params: ["actionType", "entityId"],
  },
  tryResolveForAction: {
    method: "GET",
    path: "assignments/try-resolve-for-action",
    params: ["actionType", "entityId"],
  },
  assign: { method: "PUT", path: "assignments/assign" },
  unassign: { method: "DELETE", path: "assignments/unassign" },
  bulkAssign: { method: "PUT", path: "assignments/bulk-assign" },
  getAssignment: {
    method: "GET",
    path: "assignments/get-assignment",
    params: ["actionType"],
  },
  getAllAssignments: {
    method: "GET",
    path: "assignments/get-all-assignments",
  },
  cascadeProfileDelete: {
    method: "DELETE",
    path: "assignments/cascade-profile-delete",
  },
};

/** Dependencies injected into an {@link AssignmentsEngine} instance. */
export type AssignmentsEngineDeps = {
  storage: StorageAdapter;
};

/** Resolved profile for an action — both the storage row and its ID. */
export type ResolvedAssignment = {
  profileId: string;
  profile: Profile;
};

/**
 * Outcome of {@link AssignmentsEngine.assign} / {@link AssignmentsEngine.unassign}.
 * Either a success or a field-scoped error suitable for displaying in
 * the profile editor.
 */
export type AssignmentMutationResult =
  | { success: true }
  | { success: false; error: TErrorData };

/**
 * Outcome of {@link AssignmentsEngine.bulkAssign}. Either every entry
 * persisted, or no entries persisted and a per-key error report. The
 * engine validates first and writes second so a single bad entry never
 * leaves the assignment table in a half-written state.
 */
export type BulkAssignmentResult =
  | { success: true }
  | {
      success: false;
      errors: Array<{ actionType: ActionType; error: TErrorData }>;
    };
