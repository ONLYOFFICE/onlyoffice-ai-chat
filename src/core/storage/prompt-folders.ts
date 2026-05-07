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
   * Bulk-insert folders. Storage assigns `id`, `createdAt`, and
   * `updatedAt` for each entry — callers may NOT assume that ids or
   * timestamps from a bundle survive the round-trip
   * (server-authoritative implementations generate fresh ones).
   *
   * @param folders - The folder bodies (without `id` / `createdAt` /
   *   `updatedAt`).
   * @returns Persisted folders in input order, with storage-assigned
   *   fields populated.
   */
  createMany(
    folders: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">[]
  ): Promise<PromptFolder[]>;

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
