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
    resolveForAction: (actionType) =>
      callRoute(
        config,
        "assignments",
        "resolveForAction",
        [actionType],
        engines
      ),
    tryResolveForAction: (actionType) =>
      callRoute(
        config,
        "assignments",
        "tryResolveForAction",
        [actionType],
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
    getAllAssignments: () =>
      callRoute(config, "assignments", "getAllAssignments", [], engines),
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
