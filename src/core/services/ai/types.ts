import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { AssignmentsEngine } from "../assignments";
import type { ThreadsEngine } from "../threads";
import type { RouteSpec } from "../types";
import type { AIEngine } from "./engine";

/** Public method names exposed by {@link AIEngine}. */
export type AIEngineMethod = {
  [K in keyof AIEngine]: AIEngine[K] extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof AIEngine];

/**
 * Default HTTP method + URL path for each {@link AIEngine} method.
 * Paths are relative to the host's API base URL (no leading slash).
 */
export const DEFAULT_AI_ROUTES: Record<AIEngineMethod, RouteSpec> = {
  send: { method: "POST", path: "ai/send" },
  sendCustom: { method: "POST", path: "ai/send-custom" },
  sendWithStream: { method: "POST", path: "ai/send-with-stream" },
};

/**
 * Dependencies injected into an {@link AIEngine} instance.
 *
 * `assignments` and `threads` are optional — the engine constructs
 * its own from `storage` when omitted. Pass your own when you want
 * to share a single sub-engine instance across multiple `AIEngine`s
 * or substitute a test double.
 */
export type AIEngineDeps = {
  storage: StorageAdapter;
  assignments?: AssignmentsEngine;
  threads?: ThreadsEngine;
};

/**
 * Payload for {@link AIEngine.sendWithStream}. No `actionType` — the
 * streaming path always uses the `Chat` action; the profile is resolved
 * via the `Chat` assignment slot (with fallback to `Default`).
 */
export type SendStreamInput = {
  /**
   * Target thread. If omitted, the engine creates a new thread with an
   * auto-generated title.
   */
  threadId?: string;

  userMessage: ThreadMessageLike;

  /** Forwarded to the underlying action. `profile` and `messages` are owned by the engine. */
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
};

/**
 * Payload for {@link AIEngine.send}. No thread involved — the engine
 * resolves the profile for the given action type and dispatches the
 * action with a single-message history. No storage writes, no title
 * generation, no persistence.
 */
export type SendInput = {
  /**
   * Which AI action to run. Determines both the assignment slot the
   * engine looks up (`storage.assignments.readByType(actionType)`) and
   * the underlying action function that gets invoked.
   */
  actionType: ActionType;

  userMessage: ThreadMessageLike;

  /** Forwarded to the underlying action. `profile` and `messages` are owned by the engine. */
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
};

/**
 * Payload for {@link AIEngine.sendCustom}. Free-form one-turn call with
 * a caller-supplied system prompt. The profile is resolved via the
 * `Default` assignment slot. No thread, no history, no persistence.
 *
 * `isStream` toggles between streaming and one-shot modes; method
 * overloads narrow the return type accordingly.
 */
export type SendCustomInput = {
  isStream: boolean;
  systemPrompt: string;
  userMessage: ThreadMessageLike;
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
};

/**
 * Event emitted by {@link AIEngine.sendWithStream}. Carries the resolved
 * `threadId` and `title` alongside the raw `SendMessageResult` from the
 * action so the stream is self-contained for any transport (SSE, JSON
 * chunks, Server Actions) without a separate pre-stream metadata step.
 */
export type SendResult = {
  threadId: string;
  title: string;
  result: SendMessageResult;
};
