import type { TErrorData } from "../../../shared/error-data";
import type { Prompt, PromptFolder } from "../../types";

const NAME_REQUIRED: TErrorData = {
  field: "name",
  message: "Name is required",
};

/**
 * Validate that a folder name is non-empty and globally unique
 * (case-insensitive). Returns `null` on success.
 *
 * `excludeId` skips a single folder during rename so its own name
 * doesn't collide with itself.
 */
export function validateFolderName(
  existing: PromptFolder[],
  name: string,
  excludeId?: string
): TErrorData | null {
  if (!name.trim()) return NAME_REQUIRED;
  const normalized = name.toLowerCase();
  const collision = existing.some(
    (f) => f.name.toLowerCase() === normalized && f.id !== excludeId
  );
  if (collision) {
    return { field: "name", message: "Folder name already exists" };
  }
  return null;
}

/**
 * Validate a prompt name. Names must be non-empty and unique
 * **within the folder scope** — the same name can exist in multiple
 * folders. `folderId === null`/`undefined` means "root level"; the
 * scope is consistent across the two.
 *
 * `excludeId` skips a single prompt during update / rename so its own
 * name doesn't collide with itself.
 */
export function validatePromptName(
  existing: Prompt[],
  name: string,
  folderId: string | null | undefined,
  excludeId?: string
): TErrorData | null {
  if (!name.trim()) return NAME_REQUIRED;
  const normalized = name.toLowerCase();
  const scope = folderId ?? null;
  const collision = existing.some(
    (p) =>
      p.name.toLowerCase() === normalized &&
      (p.folderId ?? null) === scope &&
      p.id !== excludeId
  );
  if (collision) {
    return {
      field: "name",
      message: "Prompt name already exists in this folder",
    };
  }
  return null;
}

/**
 * Validate that a `folderId` reference points at an existing folder.
 * `null`/`undefined` is the root scope and is always valid.
 */
export function validateFolderReference(
  existing: PromptFolder[],
  folderId: string | null | undefined
): TErrorData | null {
  if (folderId === null || folderId === undefined) return null;
  const exists = existing.some((f) => f.id === folderId);
  if (!exists) {
    return { field: "name", message: `Folder not found: ${folderId}` };
  }
  return null;
}
