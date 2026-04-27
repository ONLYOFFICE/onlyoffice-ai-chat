import type { ActionType } from "../../shared/action-type";

/**
 * Storage interface mapping each {@link ActionType} to the ID of the
 * {@link Profile} responsible for handling it. Used by engines to resolve
 * which profile to invoke for a given action (e.g. which profile runs
 * the Chat action).
 *
 * Implementations must persist assignments across reloads.
 */
export interface AssignmentsStorage {
  /**
   * Assign a profile to an action type for the first time. Throws if an
   * assignment already exists for the given action.
   *
   * @param actionType - The action to assign.
   * @param profileId - The profile ID to bind.
   */
  create(actionType: ActionType, profileId: string): Promise<void>;

  /**
   * Get the profile ID assigned to an action type.
   *
   * @param actionType - The action to look up.
   * @returns The assigned profile ID, or `null` if no assignment exists.
   */
  readByType(actionType: ActionType): Promise<string | null>;

  /**
   * Retrieve every assignment as a map. Missing entries are omitted.
   */
  readAll(): Promise<Partial<Record<ActionType, string>>>;

  /**
   * Replace the profile bound to an existing action-type assignment.
   * Throws if no assignment exists for the given action.
   *
   * @param actionType - The action whose assignment to update.
   * @param profileId - The new profile ID to bind.
   */
  update(actionType: ActionType, profileId: string): Promise<void>;

  /**
   * Apply many bindings in a single backend round-trip. Idempotent
   * per entry: creates the assignment when the slot is empty, replaces
   * it when bound to a different profile, and is a no-op when bound to
   * the same profile already. Implementations are expected to run all
   * writes in one transaction so the assignment table never observes a
   * half-written state.
   *
   * @param assignments - Map of action types to profile IDs to bind.
   */
  upsertMany(
    assignments: Partial<Record<ActionType, string>>
  ): Promise<void>;

  /**
   * Remove the assignment for an action type. No-op if no assignment
   * exists for the given action.
   *
   * @param actionType - The action to unassign.
   */
  delete(actionType: ActionType): Promise<void>;

  /**
   * Remove multiple assignments in a single backend round-trip. No-op for
   * any action type that has no existing assignment.
   *
   * @param actionTypes - The actions to unassign.
   */
  deleteMany(actionTypes: ActionType[]): Promise<void>;
}
