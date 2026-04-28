import type {
  PromptsEngine,
  PromptsEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type PromptsApi = {
  [K in PromptsEngineMethod]: (
    ...args: Parameters<PromptsEngine[K]>
  ) => ReturnType<PromptsEngine[K]>;
};

export function createPromptsApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): PromptsApi {
  return {
    create: (input) => callRoute(config, "prompts", "create", [input], engines),
    update: (id, updates) =>
      callRoute(config, "prompts", "update", [id, updates], engines),
    move: (id, folderId) =>
      callRoute(config, "prompts", "move", [id, folderId], engines),
    delete: (id) => callRoute(config, "prompts", "delete", [id], engines),
    list: (folderId) =>
      callRoute(config, "prompts", "list", [folderId], engines),
    createFolder: (name) =>
      callRoute(config, "prompts", "createFolder", [name], engines),
    renameFolder: (id, name) =>
      callRoute(config, "prompts", "renameFolder", [id, name], engines),
    deleteFolder: (id) =>
      callRoute(config, "prompts", "deleteFolder", [id], engines),
    listFolders: () => callRoute(config, "prompts", "listFolders", [], engines),
    export: () => callRoute(config, "prompts", "export", [], engines),
    importBundle: (bundle, options) =>
      callRoute(config, "prompts", "importBundle", [bundle, options], engines),
    getById: (id) => callRoute(config, "prompts", "getById", [id], engines),
    getFolderById: (id) =>
      callRoute(config, "prompts", "getFolderById", [id], engines),
  };
}
