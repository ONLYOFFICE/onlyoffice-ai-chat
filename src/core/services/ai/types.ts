import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import type { ToolsAdapter } from "../../tools-adapter";
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
  regenerateStream: { method: "POST", path: "ai/regenerate-stream" },
  approveToolCall: { method: "POST", path: "ai/approve-tool-call" },
  denyToolCall: { method: "POST", path: "ai/deny-tool-call" },
};

/**
 * Dependencies injected into an {@link AIEngine} instance.
 *
 * The engine is **transport-agnostic and side-effect-free beyond
 * storage**: it never invokes user middleware or emits UI callbacks
 * directly. Both belong on the consumer side (the browser, even when
 * `AIEngine` itself runs on a server) — they wrap the
 * `AsyncGenerator<ChatEvent>` produced by the engine.
 *
 * `assignments` and `threads` are optional — the engine constructs
 * its own from `storage` when omitted.
 *
 * Tool execution itself lives entirely on the consumer side: the
 * engine surfaces `tool-call-pending` events, the consumer dispatches
 * the tool, then resumes the chat by calling {@link AIEngine.approveToolCall}
 * with the result (or {@link AIEngine.denyToolCall}). The only tools the
 * engine ever runs in-process are those served by {@link toolsAdapter}.
 */
export type AIEngineDeps = {
  storage: StorageAdapter;
  assignments?: AssignmentsEngine;
  threads?: ThreadsEngine;

  /**
   * Optional pluggable source of tools merged with caller-supplied
   * `actionArgs.tools` before each request. Adapter-served tools are
   * executed in-engine and the chat is resumed automatically; user-served
   * tools always pause on `tool-call-pending` and wait for `approveToolCall`
   * / `denyToolCall`.
   */
  toolsAdapter?: ToolsAdapter;
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

  /**
   * Opaque scope token forwarded to
   * {@link AssignmentsEngine.resolveForAction} (so the storage layer
   * can return an entity-specific Chat profile) and persisted on a
   * freshly created thread. The engine never inspects the value.
   */
  entityId?: string;
};

/**
 * Payload for {@link AIEngine.regenerateStream}. The engine drops every
 * trailing message after the last user message in the thread (the
 * previous assistant reply plus any tool-call hops) and streams a fresh
 * reply against the unchanged user prompt. The thread must already
 * exist — regenerate only operates on persisted history.
 */
export type RegenerateStreamInput = {
  /** Target thread (must exist). */
  threadId: string;

  /** Forwarded to the underlying action. `profile` and `messages` are owned by the engine. */
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;

  /**
   * Opaque scope token forwarded to
   * {@link AssignmentsEngine.resolveForAction} (so the storage layer
   * can return an entity-specific Chat profile).
   */
  entityId?: string;
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

  /**
   * Opaque scope token forwarded to
   * {@link AssignmentsEngine.resolveForAction}. Storage decides whether
   * to apply it (typically only for `ActionType.Chat`).
   */
  entityId?: string;
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
 * Identifies a pending tool call inside an assistant message and
 * carries the same `actionArgs` envelope as {@link SendStreamInput} so
 * the resume round (after approve / deny) sees the same prompts,
 * abort signal, `isReasoning` flag, and tool list as the original
 * `sendWithStream` request.
 */
export type ToolCallData = Pick<SendStreamInput, "actionArgs" | "entityId"> & {
  /** Thread the assistant message belongs to. */
  threadId: string;

  /** Storage id of the assistant message holding the tool call. */
  messageId: string;

  /**
   * Index of the tool-call content part inside `message.content`.
   * Mirrors the position the model emitted.
   */
  idx: number;

  /** Snapshot of the assistant message at the time the tool call surfaced. */
  message: ThreadMessageLike;
};

/**
 * Payload for {@link AIEngine.approveToolCall}.
 *
 * The consumer (UI) is responsible for executing the tool — the engine
 * just persists the supplied `result` onto the assistant message and
 * resumes the chat. When the user opts into "always allow" in the
 * approval dialog, set `allowAlways: true` and the engine appends the
 * tool's name to `storage.toolPrefs.allowAlways` — subsequent rounds
 * surface `tool-call-pending` with `autoAllow: true` and the consumer
 * skips the dialog.
 */
export type ApproveToolCallInput = ToolCallData & {
  /** Final result of the tool call, as the model should see it. */
  result: unknown;

  /** Persist auto-approve for this tool's name. */
  allowAlways?: boolean;
};

/**
 * Payload for {@link AIEngine.denyToolCall}.
 *
 * The tool result is replaced with `"User deny tool call"` and the chat
 * resumes immediately.
 */
export type DenyToolCallInput = ToolCallData;

/**
 * Discriminated event emitted by the streaming methods of
 * {@link AIEngine}. The engine never invokes user-supplied middleware
 * or callbacks directly — every observable side-effect is encoded as
 * a {@link ChatEvent} so the same stream can be replayed over SSE,
 * WebSocket, or in-process.
 *
 * Pause point: `tool-call-pending` is the only stop. The UI must
 * execute the tool itself (consulting `autoAllow` to decide between
 * the silent path and the approve dialog) and resume via
 * {@link AIEngine.approveToolCall} or {@link AIEngine.denyToolCall}.
 *
 * Other variants are pure data:
 *
 * - `message-start` / `message-delta` / `message-end` — assistant
 *   reply lifecycle.
 * - `message-incomplete` — the provider returned an error or
 *   incomplete status.
 * - `thread-title` — auto-generated title ready for a new thread.
 */
export type ChatEvent =
  | {
      type: "message-start";
      message: ThreadMessageLike;
      messageId: string;
    }
  | {
      type: "message-delta";
      message: ThreadMessageLike;
      messageId: string;
    }
  | {
      type: "message-end";
      message: ThreadMessageLike;
      messageId: string;
    }
  | {
      type: "message-incomplete";
      message: ThreadMessageLike;
    }
  | {
      type: "tool-call-pending";
      message: ThreadMessageLike;
      idx: number;
      messageId: string;
      threadId: string;
      /**
       * Whether the tool is in the persisted "always-allow" list —
       * the consumer should execute it without prompting the user.
       */
      autoAllow: boolean;
    }
  | {
      type: "thread-title";
      threadId: string;
      title: string;
      profileId?: string;
    };

/**
 * Legacy event shape preserved for the `sendWithStream` HTTP route —
 * carries the resolved `threadId` and `title` alongside the raw
 * `SendMessageResult`. New consumers should switch to {@link ChatEvent}.
 *
 * @deprecated kept only for source-compat with the previous AIEngine
 *   API. Internally `sendWithStream` now yields {@link ChatEvent}.
 */
export type SendResult = {
  threadId: string;
  title: string;
  result: SendMessageResult;
};
