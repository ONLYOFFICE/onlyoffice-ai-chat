import type {
  AssignmentsEngine,
  AssignmentsEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type AssignmentsApi = {
  [K in AssignmentsEngineMethod]: (
    ...args: Parameters<AssignmentsEngine[K]>
  ) => ReturnType<AssignmentsEngine[K]>;
};

export function createAssignmentsApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): AssignmentsApi {
  return {
    resolveForAction: (actionType, entityId) =>
      callRoute(
        config,
        "assignments",
        "resolveForAction",
        [actionType, entityId],
        engines
      ),
    tryResolveForAction: (actionType, entityId) =>
      callRoute(
        config,
        "assignments",
        "tryResolveForAction",
        [actionType, entityId],
        engines
      ),
    assign: (actionType, profileId) =>
      callRoute(
        config,
        "assignments",
        "assign",
        [actionType, profileId],
        engines
      ),
    unassign: (actionType) =>
      callRoute(config, "assignments", "unassign", [actionType], engines),
    bulkAssign: (entries) =>
      callRoute(config, "assignments", "bulkAssign", [entries], engines),
    getAssignment: (actionType) =>
      callRoute(config, "assignments", "getAssignment", [actionType], engines),
    getAllAssignments: (entityId) =>
      callRoute(
        config,
        "assignments",
        "getAllAssignments",
        [entityId],
        engines
      ),
    cascadeProfileDelete: (profileId) =>
      callRoute(
        config,
        "assignments",
        "cascadeProfileDelete",
        [profileId],
        engines
      ),
  };
}
