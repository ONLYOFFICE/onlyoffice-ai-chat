import type { AppContext } from "../app-context";
import logger from "../lib/logger";
import type { Prompt, PromptFolder } from "../types";

/**
 * Partial fields that can be updated on an existing prompt.
 *
 * @property name - New display name.
 * @property text - New prompt text body.
 * @property folderId - Move to a folder (`string`), remove from folder (`null`),
 *   or leave unchanged (`undefined`).
 */
export type PromptUpdates = {
  name?: string;
  text?: string;
  folderId?: string | null;
};

/**
 * Manages user-created prompt templates and prompt folders -- CRUD
 * operations backed by the storage adapter.
 *
 * Prompt names are auto-derived from the first 15 characters of the text on
 * creation. Folder deletion automatically un-assigns orphaned prompts.
 */
export class PromptsService {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }
  /**
   * Load all prompts and prompt folders from storage in parallel.
   *
   * @returns An object containing both the prompts and folders arrays.
   */
  async loadAll(): Promise<{ prompts: Prompt[]; folders: PromptFolder[] }> {
    const storage = this.ctx.storage;
    const [prompts, folders] = await Promise.all([
      storage.prompts.getAll(),
      storage.promptFolders.getAll(),
    ]);
    return { prompts, folders };
  }

  /**
   * Create a new prompt template. The name is auto-derived from the first
   * 15 characters of the prompt text.
   *
   * @param text - The full prompt text.
   * @param folderId - Optional folder to place the prompt in.
   * @returns The newly created {@link Prompt} object.
   */
  createPrompt(text: string, folderId?: string): Prompt {
    const id = crypto.randomUUID();
    const name = text.slice(0, 15);
    const now = Date.now();

    const prompt: Prompt = {
      id,
      name,
      text,
      ...(folderId && { folderId }),
      createdAt: now,
      updatedAt: now,
    };

    this.ctx.storage.prompts.create(prompt).catch(logger.error);
    return prompt;
  }

  /**
   * Apply partial updates to a prompt and return the full updated list.
   *
   * @param prompts - Current prompts array (used to produce an updated copy).
   * @param id - The prompt identifier to update.
   * @param updates - Fields to change (name, text, folderId).
   * @returns A new prompts array with the target prompt updated.
   */
  updatePrompt(
    prompts: Prompt[],
    id: string,
    updates: PromptUpdates
  ): Prompt[] {
    this.ctx.storage.prompts.update(id, updates).catch(logger.error);
    return prompts.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.text !== undefined && { text: updates.text }),
        ...(updates.folderId !== undefined && {
          folderId: updates.folderId ?? undefined,
        }),
        updatedAt: Date.now(),
      };
    });
  }

  /**
   * Delete a prompt from storage.
   *
   * @param id - The prompt identifier to remove.
   */
  deletePrompt(id: string): void {
    this.ctx.storage.prompts.delete(id).catch(logger.error);
  }

  /**
   * Create a new prompt folder.
   *
   * @param name - Display name for the folder.
   * @returns The newly created {@link PromptFolder} object.
   */
  createFolder(name: string): PromptFolder {
    const id = crypto.randomUUID();
    const now = Date.now();
    const folder: PromptFolder = { id, name, createdAt: now, updatedAt: now };
    this.ctx.storage.promptFolders.create(folder).catch(logger.error);
    return folder;
  }

  /**
   * Rename an existing prompt folder and return the updated folders list.
   *
   * @param folders - Current folders array.
   * @param id - The folder identifier to rename.
   * @param name - The new folder name.
   * @returns A new folders array with the target folder renamed.
   */
  renameFolder(
    folders: PromptFolder[],
    id: string,
    name: string
  ): PromptFolder[] {
    this.ctx.storage.promptFolders.update(id, name).catch(logger.error);
    return folders.map((f) => {
      if (f.id !== id) return f;
      return { ...f, name, updatedAt: Date.now() };
    });
  }

  /**
   * Delete a prompt folder and un-assign any prompts that belonged to it.
   *
   * @param id - The folder identifier to delete.
   * @param prompts - Current prompts array; orphaned prompts will have their
   *   `folderId` cleared.
   * @returns A new prompts array with orphaned prompts updated.
   */
  deleteFolder(id: string, prompts: Prompt[]): Prompt[] {
    this.ctx.storage.promptFolders.delete(id).catch(logger.error);
    // Reset folderId on orphaned prompts
    const updated = prompts.map((p) => {
      if (p.folderId !== id) return p;
      this.ctx.storage.prompts
        .update(p.id, { folderId: null })
        .catch(logger.error);
      return { ...p, folderId: undefined };
    });
    return updated;
  }
}
