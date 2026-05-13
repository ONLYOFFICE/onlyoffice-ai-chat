import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { AttachmentsEngine } from "./engine";

/** Public method names exposed by {@link AttachmentsEngine}. */
export type AttachmentsEngineMethod = {
  [K in keyof AttachmentsEngine]: AttachmentsEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof AttachmentsEngine];

/**
 * Default HTTP method + URL path for each {@link AttachmentsEngine}
 * method. Paths are relative to the host's API base URL (no leading
 * slash). When the widget is configured with `origin`/`baseUrl`, every
 * call round-trips through these routes; in headless mode the engine
 * is invoked in-process.
 */
export const DEFAULT_ATTACHMENTS_ROUTES: Record<
  AttachmentsEngineMethod,
  RouteSpec
> = {
  saveFile: { method: "POST", path: "attachments/save-file" },
  saveFilesMany: { method: "POST", path: "attachments/save-files-many" },
  saveImage: { method: "POST", path: "attachments/save-image" },
  saveImagesMany: { method: "POST", path: "attachments/save-images-many" },
  get: { method: "POST", path: "attachments/get" },
  getMany: { method: "POST", path: "attachments/get-many" },
  delete: { method: "DELETE", path: "attachments/delete" },
  deleteMany: { method: "DELETE", path: "attachments/delete-many" },
  linkToMessage: { method: "POST", path: "attachments/link-to-message" },
};

/** Dependencies injected into an {@link AttachmentsEngine} instance. */
export type AttachmentsEngineDeps = {
  storage: StorageAdapter;
};
