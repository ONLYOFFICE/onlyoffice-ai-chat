import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Profile } from "../../types";
import type { StorageAdapter } from "../../storage";
import type { RouteSpec } from "../types";
import type { ThreadsEngine } from "./engine";

/** Public method names exposed by {@link ThreadsEngine}. */
export type ThreadsEngineMethod = {
  [K in keyof ThreadsEngine]: ThreadsEngine[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof ThreadsEngine];

/**
 * Default HTTP method + URL path for each {@link ThreadsEngine} method.
 * Paths are relative to the host's API base URL (no leading slash).
 */
export const DEFAULT_THREADS_ROUTES: Record<ThreadsEngineMethod, RouteSpec> = {
  create: { method: "POST", path: "threads/create" },
  openOrCreate: { method: "POST", path: "threads/open-or-create" },
  appendUserMessage: { method: "POST", path: "threads/append-user-message" },
  touch: { method: "POST", path: "threads/touch" },
  rename: { method: "PUT", path: "threads/rename" },
  delete: { method: "DELETE", path: "threads/delete" },
  clearMessages: { method: "DELETE", path: "threads/clear-messages" },
  regenerateTitle: { method: "POST", path: "threads/regenerate-title" },
  // `cursor` is an object — the transport JSON-stringifies it into the
  // query value; servers `JSON.parse(req.query.cursor)` it back.
  list: {
    method: "GET",
    path: "threads/list",
    params: ["entityId", "count", "cursor"],
  },
  readMessages: {
    method: "GET",
    path: "threads/read-messages",
    params: ["threadId", "count", "cursor"],
  },
  getById: {
    method: "GET",
    path: "threads/get-by-id",
    params: ["threadId"],
  },
  getMessageById: {
    method: "GET",
    path: "threads/get-message-by-id",
    params: ["messageId"],
  },
  updateMessage: { method: "PUT", path: "threads/update-message" },
  deleteMessage: { method: "DELETE", path: "threads/delete-message" },
};

/** Dependencies injected into a {@link ThreadsEngine} instance. */
export type ThreadsEngineDeps = {
  storage: StorageAdapter;

  /**
   * Global cursor-pagination switch. When enabled, the engine's own
   * full-history reads (`openOrCreate`) fetch messages in pages of
   * {@link PAGE_SIZE} instead of one unbounded call. Does not change
   * what `list` / `readMessages` do — those only forward the caller's
   * `count` / `cursor`. Default false. Pass a function to resolve
   * lazily at request time.
   */
  pagination?: boolean | (() => boolean);
};

/**
 * Input for {@link ThreadsEngine.openOrCreate}: open an existing thread
 * if `threadId` is given, otherwise create a new one with an
 * auto-generated title derived from `firstMessage`.
 */
export type OpenOrCreateInput = {
  threadId?: string;
  profile: Profile;
  profileId: string;
  firstMessage: ThreadMessageLike;
  /**
   * Opaque scope token persisted on a freshly created thread. Ignored
   * when `threadId` is provided (the existing thread keeps its scope).
   */
  entityId?: string;
};

/** Resolved thread state returned by {@link ThreadsEngine.openOrCreate}. */
export type OpenOrCreateResult = {
  threadId: string;
  /** Empty string for existing threads — the engine doesn't re-fetch. */
  title: string;
  priorMessages: ThreadMessageLike[];
};
