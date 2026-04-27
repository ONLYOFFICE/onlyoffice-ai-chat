import type { PromptFolder } from "../types";

/**
 * Storage interface for managing prompt folders.
 *
 * Folders provide a simple one-level grouping mechanism for saved prompts.
 * Deleting a folder cascades to all prompts it contains.
 */
export interface PromptFoldersStorage {
  /**
   * Create a new prompt folder. Storage assigns the `id`, `createdAt`,
   * and `updatedAt` fields; callers provide only the folder body.
   *
   * @param input - The folder body (without `id` / `createdAt` / `updatedAt`).
   * @returns The persisted folder with all server-assigned fields populated.
   */
  create(
    input: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">
  ): Promise<PromptFolder>;

  /**
   * Create multiple folders in a single backend round-trip. Used by
   * import flows that preserve original ids and timestamps from a
   * bundle.
   *
   * @param folders - The fully-formed folders to persist (ids and
   *   timestamps included).
   */
  createMany(folders: PromptFolder[]): Promise<void>;

  /**
   * Find a folder by ID.
   *
   * @param id - The folder identifier to look up.
   * @returns The matching folder, or `null` if not found.
   */
  readById(id: string): Promise<PromptFolder | null>;

  /**
   * Retrieve all folders sorted by `createdAt` descending (newest first).
   *
   * @returns An array of all persisted folders.
   */
  readAll(): Promise<PromptFolder[]>;

  /**
   * Rename a folder. Updates the `updatedAt` timestamp.
   *
   * @param id - The folder to rename.
   * @param name - The new folder name.
   */
  update(id: string, name: string): Promise<void>;

  /**
   * Delete a folder and all prompts inside it (cascading delete).
   *
   * @param id - The folder to remove.
   */
  delete(id: string): Promise<void>;
}
