import type { Prompt } from "../types";

/**
 * Storage interface for managing saved prompts (reusable prompt templates).
 *
 * Prompts can optionally belong to a {@link PromptFolder}. Deleting a
 * folder cascades to all prompts within it via {@link PromptsStorage.deleteByFolder}.
 */
export interface PromptsStorage {
  /**
   * Create a new saved prompt. Storage assigns the `id`, `createdAt`,
   * and `updatedAt` fields; callers provide only the prompt body.
   *
   * @param input - The prompt body (without `id` / `createdAt` / `updatedAt`).
   * @returns The persisted prompt with all server-assigned fields populated.
   */
  create(
    input: Omit<Prompt, "id" | "createdAt" | "updatedAt">
  ): Promise<Prompt>;

  /**
   * Create multiple prompts in a single backend round-trip. Used by
   * import flows that preserve original ids and timestamps from a
   * bundle.
   *
   * @param prompts - The fully-formed prompts to persist (ids and
   *   timestamps included).
   */
  createMany(prompts: Prompt[]): Promise<void>;

  /**
   * Find a prompt by ID.
   *
   * @param id - The prompt identifier to look up.
   * @returns The matching prompt, or `null` if not found.
   */
  readById(id: string): Promise<Prompt | null>;

  /**
   * Retrieve all prompts sorted by `createdAt` descending (newest first).
   *
   * @returns An array of all persisted prompts.
   */
  readAll(): Promise<Prompt[]>;

  /**
   * Retrieve prompts that belong to the given folder, sorted by
   * `createdAt` descending. Pass `null` to get prompts that are not in
   * any folder (root level).
   *
   * @param folderId - The folder ID, or `null` for unfoldered prompts.
   * @returns An array of prompts scoped to the folder.
   */
  readByFolderId(folderId: string | null): Promise<Prompt[]>;

  /**
   * Partially update a prompt: name, text, and/or folderId.
   * Updates the `updatedAt` timestamp.
   *
   * @param id - The prompt to update.
   * @param updates - An object with optional `name`, `text`, and `folderId` fields.
   */
  update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ): Promise<void>;

  /**
   * Delete a single prompt by ID.
   *
   * @param id - The prompt to remove.
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all prompts in a folder. Called as part of a cascading delete
   * when a folder is removed.
   *
   * @param folderId - The folder whose prompts should be deleted.
   */
  deleteByFolder(folderId: string): Promise<void>;
}
