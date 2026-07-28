import type {
  ThreadsEngine,
  ThreadsEngineMethod,
} from "../../../core/services";
import { callRoute } from "./fetcher";
import type { ServerAPIConfig, ServerAPIEngines } from "./index";

export type ThreadsApi = {
  [K in ThreadsEngineMethod]: (
    ...args: Parameters<ThreadsEngine[K]>
  ) => ReturnType<ThreadsEngine[K]>;
};

export function createThreadsApi(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): ThreadsApi {
  return {
    create: (input) => callRoute(config, "threads", "create", [input], engines),
    openOrCreate: (input) =>
      callRoute(config, "threads", "openOrCreate", [input], engines),
    appendUserMessage: (threadId, message, profileId) =>
      callRoute(
        config,
        "threads",
        "appendUserMessage",
        [threadId, message, profileId],
        engines
      ),
    touch: (threadId, profileId) =>
      callRoute(config, "threads", "touch", [threadId, profileId], engines),
    rename: (threadId, title) =>
      callRoute(config, "threads", "rename", [threadId, title], engines),
    delete: (threadId) =>
      callRoute(config, "threads", "delete", [threadId], engines),
    clearMessages: (threadId) =>
      callRoute(config, "threads", "clearMessages", [threadId], engines),
    regenerateTitle: (threadId, profile) =>
      callRoute(
        config,
        "threads",
        "regenerateTitle",
        [threadId, profile],
        engines
      ),
    list: (entityId, count, cursor) =>
      callRoute(config, "threads", "list", [entityId, count, cursor], engines),
    readMessages: (threadId, count, cursor) =>
      callRoute(
        config,
        "threads",
        "readMessages",
        [threadId, count, cursor],
        engines
      ),
    getById: (threadId) =>
      callRoute(config, "threads", "getById", [threadId], engines),
    getMessageById: (messageId) =>
      callRoute(config, "threads", "getMessageById", [messageId], engines),
    updateMessage: (messageId, message) =>
      callRoute(
        config,
        "threads",
        "updateMessage",
        [messageId, message],
        engines
      ),
    deleteMessage: (messageId) =>
      callRoute(config, "threads", "deleteMessage", [messageId], engines),
  };
}
