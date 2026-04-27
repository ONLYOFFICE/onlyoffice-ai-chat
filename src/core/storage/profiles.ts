import type { Profile } from "../types";

/**
 * Storage interface for managing AI provider profiles.
 *
 * A profile contains an API key, provider type, selected model, and
 * capability flags. Profiles are referenced by threads and used by the
 * `ChatEngine` to route requests to the correct provider.
 */
export interface ProfilesStorage {
  /**
   * Create a single AI provider profile.
   *
   * @param profile - The profile to persist.
   */
  create(profile: Omit<Profile, "id" | "createdAt">): Promise<Profile>;

  /**
   * Create multiple profiles in a single transaction. Storage assigns
   * the `id` and `createdAt` fields for each entry. Used for migration
   * or bulk import.
   *
   * @param profiles - The profile bodies (without `id` / `createdAt`).
   * @returns The persisted profiles with server-assigned fields populated,
   *   in the same order as the input.
   */
  createMany(
    profiles: Omit<Profile, "id" | "createdAt">[]
  ): Promise<Profile[]>;

  /**
   * Find a profile by ID.
   *
   * @param id - The profile identifier to look up.
   * @returns The matching profile, or `undefined` if not found.
   */
  readById(id: string): Promise<Profile | undefined>;

  /**
   * Retrieve all profiles.
   *
   * @returns An array of all persisted profiles.
   */
  readAll(): Promise<Profile[]>;

  /**
   * Update a profile by replacing all fields.
   *
   * @param profile - The profile with updated values. Must include the `id`.
   */
  update(profile: Profile): Promise<void>;

  /**
   * Delete a profile by ID.
   *
   * @param id - The profile to remove.
   */
  delete(id: string): Promise<void>;
}
