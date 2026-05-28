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
   * assignment already exists for the given action (in the given scope).
   *
   * The engine treats `entityId` as opaque and forwards it untouched —
   * implementations decide what to do with it. Typical usage: when
   * `actionType === ActionType.Chat` and `entityId != null`, create a
   * per-entity ("room") Chat assignment alongside the globally assigned
   * one. For all other action types `entityId` is normally ignored.
   *
   * @param actionType - The action to assign.
   * @param profileId - The profile ID to bind.
   * @param entityId - Optional opaque scope token.
   */
  create(
    actionType: ActionType,
    profileId: string,
    entityId?: string
  ): Promise<void>;

  /**
   * Get the profile ID assigned to an action type, optionally scoped
   * to an entity ("room").
   *
   * The engine treats `entityId` as opaque and forwards it untouched —
   * implementations decide what to do with it. Typical usage: when
   * `actionType === ActionType.Chat` and `entityId != null`, return the
   * entity's per-room chat profile instead of the globally assigned one.
   * For all other action types `entityId` is normally ignored.
   *
   * @param actionType - The action to look up.
   * @param entityId - Optional opaque scope token.
   * @returns The assigned profile ID, or `null` if no assignment exists.
   */
  readByType(actionType: ActionType, entityId?: string): Promise<string | null>;

  /**
   * Retrieve every assignment as a map. Missing entries are omitted.
   */
  readAll(): Promise<Partial<Record<ActionType, string>>>;

  /**
   * Replace the profile bound to an existing action-type assignment.
   * Throws if no assignment exists for the given action (in the given
   * scope).
   *
   * `entityId` is opaque and forwarded untouched — when provided,
   * implementations should target the per-entity ("room") assignment
   * for the given action type instead of the globally assigned one.
   * For action types that don't support entity scoping, `entityId` is
   * normally ignored.
   *
   * @param actionType - The action whose assignment to update.
   * @param profileId - The new profile ID to bind.
   * @param entityId - Optional opaque scope token.
   */
  update(
    actionType: ActionType,
    profileId: string,
    entityId?: string
  ): Promise<void>;

  /**
   * Apply many bindings in a single backend round-trip. Idempotent
   * per entry: creates the assignment when the slot is empty, replaces
   * it when bound to a different profile, and is a no-op when bound to
   * the same profile already. Implementations are expected to run all
   * writes in one transaction so the assignment table never observes a
   * half-written state.
   *
   * `entityId` is opaque and applies to every entry in the batch — when
   * provided, implementations should target per-entity ("room")
   * assignments instead of the globally assigned ones. For action types
   * that don't support entity scoping, `entityId` is normally ignored.
   *
   * @param assignments - Map of action types to profile IDs to bind.
   * @param entityId - Optional opaque scope token applied to all entries.
   */
  upsertMany(
    assignments: Partial<Record<ActionType, string>>,
    entityId?: string
  ): Promise<void>;

  /**
   * Remove the assignment for an action type. No-op if no assignment
   * exists for the given action (in the given scope).
   *
   * `entityId` is opaque and forwarded untouched — when provided,
   * implementations should remove the per-entity ("room") assignment
   * for the given action type instead of the globally assigned one.
   * For action types that don't support entity scoping, `entityId` is
   * normally ignored.
   *
   * @param actionType - The action to unassign.
   * @param entityId - Optional opaque scope token.
   */
  delete(actionType: ActionType, entityId?: string): Promise<void>;

  /**
   * Remove multiple assignments in a single backend round-trip. No-op for
   * any action type that has no existing assignment (in the given scope).
   *
   * `entityId` is opaque and applies to every entry in the batch — when
   * provided, implementations should remove per-entity ("room")
   * assignments instead of the globally assigned ones. For action types
   * that don't support entity scoping, `entityId` is normally ignored.
   *
   * @param actionTypes - The actions to unassign.
   * @param entityId - Optional opaque scope token applied to all entries.
   */
  deleteMany(actionTypes: ActionType[], entityId?: string): Promise<void>;
}
