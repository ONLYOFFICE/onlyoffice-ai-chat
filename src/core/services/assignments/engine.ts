import { ActionType } from "../../../shared/action-type";
import type { TErrorData } from "../../../shared/error-data";
import type { Profile } from "../../types";
import { meetsRequirements } from "./requirements";
import type {
  AssignmentMutationResult,
  AssignmentsEngineDeps,
  BulkAssignmentResult,
  ResolvedAssignment,
} from "./types";

/**
 * Assignment lifecycle orchestrator. Wraps `storage.assignments` with
 * the rules that plain CRUD can't express:
 *
 * - **Profile resolution** with `Default` fallback for action dispatch.
 * - **Capability validation** — refuse to bind a profile that doesn't
 *   declare the required {@link CapabilitiesUI} bits for the slot.
 * - **Idempotent writes** — upsert semantics so callers don't have to
 *   branch on `create` vs `update`.
 * - **Bulk assign** with all-or-nothing transactional semantics.
 * - **Default promotion** on profile delete — the cascade hook used
 *   by {@link ProfilesEngine.delete}.
 */
export class AssignmentsEngine {
  private readonly deps: AssignmentsEngineDeps;

  constructor(deps: AssignmentsEngineDeps) {
    this.deps = deps;
  }

  /**
   * Resolve the profile bound to `actionType`, falling back to the
   * `Default` slot when nothing is bound to the specific action. Throws
   * if neither slot is set or the resolved ID is missing from
   * `storage.profiles`.
   */
  async resolveForAction(
    actionType: ActionType,
    entityId?: string
  ): Promise<ResolvedAssignment> {
    const result = await this.tryResolveForAction(actionType, entityId);
    if (!result) {
      throw new Error(
        `No profile assigned to ActionType.${actionType} and no default set`
      );
    }
    return result;
  }

  /**
   * Same as {@link resolveForAction} but returns `null` instead of
   * throwing when no profile is available. Use this when the caller
   * wants to render a "not configured" state instead of crashing.
   *
   * `entityId` is opaque to the engine and forwarded to
   * {@link AssignmentsStorage.readByType} so the storage layer can
   * return an entity-specific profile (typically for `ActionType.Chat`).
   * The `Default` fallback lookup is unscoped — entity-specific defaults
   * are not a concept the engine tracks.
   */
  async tryResolveForAction(
    actionType: ActionType,
    entityId?: string
  ): Promise<ResolvedAssignment | null> {
    const { storage } = this.deps;
    const profileId =
      (await storage.assignments.readByType(actionType, entityId)) ??
      (await storage.assignments.readByType(ActionType.Default));
    if (!profileId) return null;

    const profile = await storage.profiles.readById(profileId);
    if (!profile) {
      throw new Error(`Assigned profile not found: ${profileId}`);
    }
    return { profileId, profile };
  }

  /**
   * Bind `profileId` to `actionType`, creating the assignment if it
   * does not exist or updating it if it does. Validates capability
   * requirements unless the slot is `Default`.
   */
  async assign(
    actionType: ActionType,
    profileId: string
  ): Promise<AssignmentMutationResult> {
    const profile = await this.deps.storage.profiles.readById(profileId);
    if (!profile) {
      return {
        success: false,
        error: { field: "name", message: "Profile not found" },
      };
    }

    const error = capabilityError(profile, actionType);
    if (error) return { success: false, error };

    await this.deps.storage.assignments.upsertMany({ [actionType]: profileId });
    return { success: true };
  }

  /**
   * Remove the binding for `actionType`. No-op if the slot was already
   * empty.
   */
  async unassign(actionType: ActionType): Promise<void> {
    await this.deps.storage.assignments.delete(actionType);
  }

  /**
   * Apply many assignments at once. Validates every entry first; writes
   * nothing if any entry fails so the assignment table is never left in
   * a half-written state.
   */
  async bulkAssign(
    map: Partial<Record<ActionType, string>>
  ): Promise<BulkAssignmentResult> {
    const entries = Object.entries(map) as [ActionType, string][];

    const profiles = await Promise.all(
      entries.map(([, id]) => this.deps.storage.profiles.readById(id))
    );

    const errors: Array<{ actionType: ActionType; error: TErrorData }> = [];
    entries.forEach(([actionType, profileId], i) => {
      const profile = profiles[i];
      if (!profile) {
        errors.push({
          actionType,
          error: { field: "name", message: `Profile not found: ${profileId}` },
        });
        return;
      }
      const error = capabilityError(profile, actionType);
      if (error) errors.push({ actionType, error });
    });

    if (errors.length > 0) return { success: false, errors };

    await this.deps.storage.assignments.upsertMany(map);
    return { success: true };
  }

  /** Read a single binding. Direct passthrough to storage. */
  async getAssignment(actionType: ActionType): Promise<string | null> {
    return this.deps.storage.assignments.readByType(actionType);
  }

  /** Read the full assignment map. Direct passthrough to storage. */
  async getAllAssignments(): Promise<Partial<Record<ActionType, string>>> {
    return this.deps.storage.assignments.readAll();
  }

  /**
   * Cascade hook for profile deletion. Runs **before**
   * `storage.profiles.delete`:
   *
   * - If the deleted profile holds the `Default` slot, promote the
   *   first remaining profile (insertion order from
   *   `storage.profiles.readAll`) to `Default`. If nothing remains,
   *   drop the `Default` assignment.
   * - For every other slot pointing at the deleted profile, drop the
   *   binding outright — no automatic fallback to `Default`.
   *
   * Used by {@link ProfilesEngine.delete}; not called from the UI
   * directly.
   */
  async cascadeProfileDelete(profileId: string): Promise<void> {
    const { storage } = this.deps;
    const assignments = await storage.assignments.readAll();

    if (assignments[ActionType.Default] === profileId) {
      const profiles = await storage.profiles.readAll();
      const next = profiles.find((p) => p.id !== profileId);
      if (next) {
        await storage.assignments.update(ActionType.Default, next.id);
      } else {
        await storage.assignments.delete(ActionType.Default);
      }
    }

    const orphaned = (Object.entries(assignments) as [ActionType, string][])
      .filter(([type, id]) => id === profileId && type !== ActionType.Default)
      .map(([type]) => type);

    if (orphaned.length > 0) {
      await storage.assignments.deleteMany(orphaned);
    }
  }
}

/**
 * Format a capability mismatch as a `TErrorData`. Returns `null` when
 * `profile` satisfies the slot's requirements.
 */
function capabilityError(
  profile: Pick<Profile, "capabilities">,
  actionType: ActionType
): TErrorData | null {
  if (meetsRequirements(profile, actionType)) return null;
  return {
    field: "name",
    message: `Profile lacks capabilities required for ActionType.${actionType}`,
  };
}
