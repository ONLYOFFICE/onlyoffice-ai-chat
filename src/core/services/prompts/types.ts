import type { TErrorData } from "../../../shared/error-data";
import type { Prompt, PromptFolder } from "../../types";
import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { PromptsEngine } from "./engine";

/**
 * Public method names exposed by {@link PromptsEngine}.
 *
 * `replaceAll` and `mergeBundle` are TS-soft-private and leak through
 * `keyof`; they're excluded explicitly.
 */
export type PromptsEngineMethod = Exclude<
  {
    [K in keyof PromptsEngine]: PromptsEngine[K] extends (
      ...args: never[]
    ) => unknown
      ? K
      : never;
  }[keyof PromptsEngine],
  "replaceAll" | "mergeBundle"
>;

/**
 * Default HTTP method + URL path for each {@link PromptsEngine} method.
 * Paths are relative to the host's API base URL (no leading slash).
 */
export const DEFAULT_PROMPTS_ROUTES: Record<PromptsEngineMethod, RouteSpec> = {
  create: { method: "POST", path: "prompts/create" },
  update: { method: "PUT", path: "prompts/update" },
  move: { method: "PUT", path: "prompts/move" },
  delete: { method: "DELETE", path: "prompts/delete" },
  list: { method: "GET", path: "prompts/list" },
  createFolder: { method: "POST", path: "prompts/create-folder" },
  renameFolder: { method: "PUT", path: "prompts/rename-folder" },
  deleteFolder: { method: "DELETE", path: "prompts/delete-folder" },
  listFolders: { method: "GET", path: "prompts/list-folders" },
  export: { method: "GET", path: "prompts/export" },
  importBundle: { method: "POST", path: "prompts/import-bundle" },
};

/** Dependencies injected into a {@link PromptsEngine} instance. */
export type PromptsEngineDeps = {
  storage: StorageAdapter;
};

/** Input for creating a prompt — the engine generates `id`/`createdAt`/`updatedAt`. */
export type CreatePromptInput = {
  name: string;
  text: string;
  folderId?: string | null;
};

/**
 * Outcome of `create` / `update` / `move` on a prompt — either the
 * persisted prompt or a field-scoped error.
 */
export type PromptMutationResult =
  | { success: true; prompt: Prompt }
  | { success: false; error: TErrorData };

/**
 * Outcome of `createFolder` / `renameFolder` — either the persisted
 * folder or a field-scoped error.
 */
export type FolderMutationResult =
  | { success: true; folder: PromptFolder }
  | { success: false; error: TErrorData };

/**
 * Versioned, self-contained bundle of every saved prompt and folder.
 * Stable wire format — `version` lets the import path migrate older
 * shapes if the schema ever changes.
 */
export type PromptBundle = {
  version: 1;
  folders: PromptFolder[];
  prompts: Prompt[];
};

/**
 * Outcome of {@link PromptsEngine.importBundle}. Either every entry
 * persisted with counts, or no entries persisted plus a per-entry
 * error report.
 */
export type ImportResult =
  | {
      success: true;
      imported: { folders: number; prompts: number };
    }
  | {
      success: false;
      errors: ImportError[];
    };

/** Per-entry error reported by {@link PromptsEngine.importBundle}. */
export type ImportError = {
  /** `"folder"` or `"prompt"`, plus the offending name or id. */
  kind: "folder" | "prompt";
  ref: string;
  error: TErrorData;
};

/** Mode passed to {@link PromptsEngine.importBundle}. */
export type ImportMode = "replace" | "merge";
