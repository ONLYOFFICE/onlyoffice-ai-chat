import type { Prompt, PromptFolder } from "../../types";
import type {
  CreatePromptInput,
  FolderMutationResult,
  ImportError,
  ImportMode,
  ImportResult,
  PromptBundle,
  PromptMutationResult,
  PromptsEngineDeps,
} from "./types";
import {
  validateFolderName,
  validateFolderReference,
  validatePromptName,
} from "./validation";

/**
 * Prompt and prompt-folder lifecycle orchestrator. Wraps
 * `storage.prompts` + `storage.promptFolders` with the rules that
 * plain CRUD can't express:
 *
 * - **Folder name uniqueness** (case-insensitive, global — no
 *   nesting).
 * - **Prompt name uniqueness within folder scope** (case-insensitive).
 *   The same name can exist in multiple folders.
 * - **Folder-reference integrity** — `prompt.folderId` must point at
 *   an existing folder (or be `null`/`undefined` for root).
 * - **Atomic move** between folders with a re-validation of the
 *   target scope.
 * - **Versioned import / export** — `PromptBundle` round-trips the
 *   full library, with `merge` (idempotent upsert) and `replace`
 *   (wipe-and-rewrite) modes.
 */
export class PromptsEngine {
  private readonly deps: PromptsEngineDeps;

  constructor(deps: PromptsEngineDeps) {
    this.deps = deps;
  }

  // ---------------------------------------------------------------------------
  // Prompts
  // ---------------------------------------------------------------------------

  /**
   * Persist a new prompt. Validates name (non-empty + unique in
   * folder scope) and `folderId` reference. Returns the persisted
   * prompt or a field-scoped error.
   */
  async create(input: CreatePromptInput): Promise<PromptMutationResult> {
    const folders = await this.deps.storage.promptFolders.readAll();
    const refError = validateFolderReference(folders, input.folderId);
    if (refError) return { success: false, error: refError };

    const existing = await this.deps.storage.prompts.readAll();
    const nameError = validatePromptName(existing, input.name, input.folderId);
    if (nameError) return { success: false, error: nameError };

    const prompt = await this.deps.storage.prompts.create({
      name: input.name,
      text: input.text,
      folderId: input.folderId ?? undefined,
    });
    return { success: true, prompt };
  }

  /**
   * Partially update a prompt. Re-validates name and folder
   * reference if either is changing. Returns the updated prompt.
   */
  async update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ): Promise<PromptMutationResult> {
    const current = await this.deps.storage.prompts.readById(id);
    if (!current) {
      return {
        success: false,
        error: { field: "name", message: `Prompt not found: ${id}` },
      };
    }

    const nextFolderId =
      updates.folderId === undefined ? current.folderId : updates.folderId;

    if (updates.folderId !== undefined && updates.folderId !== null) {
      const folders = await this.deps.storage.promptFolders.readAll();
      const refError = validateFolderReference(folders, updates.folderId);
      if (refError) return { success: false, error: refError };
    }

    if (updates.name !== undefined) {
      const all = await this.deps.storage.prompts.readAll();
      const nameError = validatePromptName(all, updates.name, nextFolderId, id);
      if (nameError) return { success: false, error: nameError };
    }

    await this.deps.storage.prompts.update(id, updates);
    const updated = await this.deps.storage.prompts.readById(id);
    if (!updated) {
      throw new Error(`Prompt disappeared mid-update: ${id}`);
    }
    return { success: true, prompt: updated };
  }

  /**
   * Move a prompt to a different folder (or to the root with
   * `folderId === null`). Re-validates the name in the target scope
   * — moving a prompt named "Summarize" into a folder that already
   * has one fails.
   */
  async move(
    id: string,
    folderId: string | null
  ): Promise<PromptMutationResult> {
    return this.update(id, { folderId });
  }

  /** Delete a prompt. No-op if it does not exist. */
  async delete(id: string): Promise<void> {
    await this.deps.storage.prompts.delete(id);
  }

  /**
   * List prompts. Pass `folderId` to scope to a folder; pass `null`
   * for root-level only; omit to list every prompt sorted by
   * `createdAt` desc.
   */
  async list(folderId?: string | null): Promise<Prompt[]> {
    if (folderId === undefined) return this.deps.storage.prompts.readAll();
    return this.deps.storage.prompts.readByFolderId(folderId);
  }

  // ---------------------------------------------------------------------------
  // Folders
  // ---------------------------------------------------------------------------

  /** Create a new folder. Validates name (non-empty + globally unique). */
  async createFolder(name: string): Promise<FolderMutationResult> {
    const existing = await this.deps.storage.promptFolders.readAll();
    const error = validateFolderName(existing, name);
    if (error) return { success: false, error };

    const folder = await this.deps.storage.promptFolders.create({ name });
    return { success: true, folder };
  }

  /** Rename a folder. Validates the new name against existing folders. */
  async renameFolder(id: string, name: string): Promise<FolderMutationResult> {
    const existing = await this.deps.storage.promptFolders.readAll();
    if (!existing.some((f) => f.id === id)) {
      return {
        success: false,
        error: { field: "name", message: `Folder not found: ${id}` },
      };
    }

    const error = validateFolderName(existing, name, id);
    if (error) return { success: false, error };

    await this.deps.storage.promptFolders.update(id, name);
    const updated = await this.deps.storage.promptFolders.readById(id);
    if (!updated) {
      throw new Error(`Folder disappeared mid-rename: ${id}`);
    }
    return { success: true, folder: updated };
  }

  /**
   * Delete a folder. The cascade to prompts inside the folder is
   * provided by `storage.promptFolders.delete` (per the storage
   * contract).
   */
  async deleteFolder(id: string): Promise<void> {
    await this.deps.storage.promptFolders.delete(id);
  }

  /** List folders sorted by `createdAt` desc. Direct passthrough. */
  async listFolders(): Promise<PromptFolder[]> {
    return this.deps.storage.promptFolders.readAll();
  }

  /** Retrieve a single prompt by id, or `null` if it does not exist. */
  async getById(id: string): Promise<Prompt | null> {
    return this.deps.storage.prompts.readById(id);
  }

  /** Retrieve a single folder by id, or `null` if it does not exist. */
  async getFolderById(id: string): Promise<PromptFolder | null> {
    return this.deps.storage.promptFolders.readById(id);
  }

  // ---------------------------------------------------------------------------
  // Import / export
  // ---------------------------------------------------------------------------

  /** Build a self-contained, versioned bundle of every saved prompt and folder. */
  async export(): Promise<PromptBundle> {
    const [folders, prompts] = await Promise.all([
      this.deps.storage.promptFolders.readAll(),
      this.deps.storage.prompts.readAll(),
    ]);
    return { version: 1, folders, prompts };
  }

  /**
   * Restore a {@link PromptBundle}. Two modes:
   *
   * - `replace` (default): wipe the existing prompts and folders,
   *   then write the bundle. All-or-nothing.
   * - `merge`: keep existing data and write entries from the bundle
   *   on top — `update` when the id already exists, `create`
   *   otherwise.
   *
   * Both modes validate folder references inside the bundle first
   * so a corrupt bundle is rejected before any write.
   */
  async importBundle(
    bundle: PromptBundle,
    options?: { mode?: ImportMode }
  ): Promise<ImportResult> {
    const mode: ImportMode = options?.mode ?? "replace";

    if (bundle.version !== 1) {
      return {
        success: false,
        errors: [
          {
            kind: "folder",
            ref: "<bundle>",
            error: {
              field: "name",
              message: `Unsupported bundle version: ${bundle.version}`,
            },
          },
        ],
      };
    }

    const errors = validateBundleReferences(bundle);
    if (errors.length > 0) return { success: false, errors };

    if (mode === "replace") {
      await this.replaceAll(bundle);
    } else {
      await this.mergeBundle(bundle);
    }

    return {
      success: true,
      imported: {
        folders: bundle.folders.length,
        prompts: bundle.prompts.length,
      },
    };
  }

  /** Wipe and re-write. Used by `importBundle({ mode: "replace" })`. */
  private async replaceAll(bundle: PromptBundle): Promise<void> {
    const [existingFolders, existingPrompts] = await Promise.all([
      this.deps.storage.promptFolders.readAll(),
      this.deps.storage.prompts.readAll(),
    ]);

    // Drop prompts first so the cascade triggered by folder.delete
    // has nothing to do; then drop folders.
    await Promise.all(
      existingPrompts.map((p) => this.deps.storage.prompts.delete(p.id))
    );
    await Promise.all(
      existingFolders.map((f) => this.deps.storage.promptFolders.delete(f.id))
    );

    // Insert folders, build oldId → newId map so prompt.folderId
    // references survive across storages that mint fresh ids.
    const folderIdMap = new Map<string, string>();
    if (bundle.folders.length > 0) {
      const persisted = await this.deps.storage.promptFolders.createMany(
        bundle.folders.map(({ name }) => ({ name }))
      );
      bundle.folders.forEach((src, i) => {
        const next = persisted[i];
        if (next) folderIdMap.set(src.id, next.id);
      });
    }

    if (bundle.prompts.length > 0) {
      await this.deps.storage.prompts.createMany(
        bundle.prompts.map((p) => {
          const next: Omit<Prompt, "id" | "createdAt" | "updatedAt"> = {
            name: p.name,
            text: p.text,
          };
          if (p.folderId) {
            const remapped = folderIdMap.get(p.folderId);
            if (remapped) next.folderId = remapped;
          }
          return next;
        })
      );
    }
  }

  /**
   * Idempotent upsert per entry. Used by `importBundle({ mode: "merge" })`.
   *
   * Match keys are natural, not id-based: folders match by `name`,
   * prompts by `(name, folderId)`. Bundle ids are not stable across
   * storages (server-authoritative backends mint fresh ones), so id
   * matching would never hit on a fresh import.
   */
  private async mergeBundle(bundle: PromptBundle): Promise<void> {
    const [existingFolders, existingPrompts] = await Promise.all([
      this.deps.storage.promptFolders.readAll(),
      this.deps.storage.prompts.readAll(),
    ]);

    const folderByName = new Map(
      existingFolders.map((f) => [f.name, f] as const)
    );
    const folderIdMap = new Map<string, string>();
    const newFolderInputs: Array<{ name: string }> = [];
    const newFolderSources: PromptFolder[] = [];

    for (const f of bundle.folders) {
      const existing = folderByName.get(f.name);
      if (existing) {
        folderIdMap.set(f.id, existing.id);
      } else {
        newFolderInputs.push({ name: f.name });
        newFolderSources.push(f);
      }
    }
    if (newFolderInputs.length > 0) {
      const persisted =
        await this.deps.storage.promptFolders.createMany(newFolderInputs);
      newFolderSources.forEach((src, i) => {
        const next = persisted[i];
        if (next) folderIdMap.set(src.id, next.id);
      });
    }

    const promptKey = (name: string, folderId: string | null) =>
      `${name}\x00${folderId ?? ""}`;
    const existingPromptByKey = new Map(
      existingPrompts.map(
        (p) => [promptKey(p.name, p.folderId ?? null), p] as const
      )
    );

    const newPromptInputs: Array<
      Omit<Prompt, "id" | "createdAt" | "updatedAt">
    > = [];
    const updates: Array<{
      id: string;
      patch: { name?: string; text?: string; folderId?: string | null };
    }> = [];

    for (const p of bundle.prompts) {
      const remappedFolderId = p.folderId
        ? (folderIdMap.get(p.folderId) ?? null)
        : null;
      const key = promptKey(p.name, remappedFolderId);
      const existing = existingPromptByKey.get(key);
      if (existing) {
        updates.push({
          id: existing.id,
          patch: { text: p.text, folderId: remappedFolderId },
        });
      } else {
        const next: Omit<Prompt, "id" | "createdAt" | "updatedAt"> = {
          name: p.name,
          text: p.text,
        };
        if (remappedFolderId) next.folderId = remappedFolderId;
        newPromptInputs.push(next);
      }
    }

    if (newPromptInputs.length > 0) {
      await this.deps.storage.prompts.createMany(newPromptInputs);
    }
    await Promise.all(
      updates.map((u) => this.deps.storage.prompts.update(u.id, u.patch))
    );
  }
}

/**
 * Verify every prompt's `folderId` inside a bundle resolves against
 * a folder also inside the bundle. Returns one `ImportError` per
 * dangling reference.
 */
function validateBundleReferences(bundle: PromptBundle): ImportError[] {
  const folderIds = new Set(bundle.folders.map((f) => f.id));
  const errors: ImportError[] = [];
  for (const prompt of bundle.prompts) {
    if (prompt.folderId && !folderIds.has(prompt.folderId)) {
      errors.push({
        kind: "prompt",
        ref: prompt.id,
        error: {
          field: "name",
          message: `Prompt '${prompt.name}' references missing folder '${prompt.folderId}'`,
        },
      });
    }
  }
  return errors;
}
