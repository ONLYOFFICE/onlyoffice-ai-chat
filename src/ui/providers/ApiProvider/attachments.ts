import type {
  AttachmentsEngine,
  AttachmentsEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type AttachmentsApi = {
  [K in AttachmentsEngineMethod]: (
    ...args: Parameters<AttachmentsEngine[K]>
  ) => ReturnType<AttachmentsEngine[K]>;
};

export function createAttachmentsApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): AttachmentsApi {
  return {
    saveFile: (input, entityId) =>
      callRoute(config, "attachments", "saveFile", [input, entityId], engines),
    saveImage: (input, entityId) =>
      callRoute(config, "attachments", "saveImage", [input, entityId], engines),
    get: (id) => callRoute(config, "attachments", "get", [id], engines),
    getMany: (ids) =>
      callRoute(config, "attachments", "getMany", [ids], engines),
    delete: (id) => callRoute(config, "attachments", "delete", [id], engines),
    deleteMany: (ids) =>
      callRoute(config, "attachments", "deleteMany", [ids], engines),
    linkToMessage: (ids, messageId, threadId) =>
      callRoute(
        config,
        "attachments",
        "linkToMessage",
        [ids, messageId, threadId],
        engines
      ),
  };
}
