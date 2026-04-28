import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ActionType } from "../../../shared/action-type";
import type { TMCPItem } from "../../../shared/mcp-item";
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
  approveToolCall: { method: "POST", path: "ai/approve-tool-call" },
  denyToolCall: { method: "POST", path: "ai/deny-tool-call" },
  continueAfterToolCall: {
    method: "POST",
    path: "ai/continue-after-tool-call",
  },
  stop: { method: "POST", path: "ai/stop" },
};

/**
 * Runtime contract for executing tool calls. The engine itself stays
 * transport-agnostic — the dispatcher knows how to talk to live MCP
 * servers, host tools, web-search, image-generation, etc.
 *
 * The browser runtime implementation lives in `src/tools/`; a server
 * runtime can implement the same contract over HTTP / IPC.
 */
export interface ToolDispatcher {
  /** Map a prefixed tool name (`"mcp-foo_bar"`) back to its server type. */
  getServerType(toolName: string): string;

  /**
   * Execute a tool call and return the raw result. Implementations
   * stringify errors into the result so the model can react to them.
   */
  callTool(
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown>;

  /** Persisted "always-allow" flag for the given tool. */
  isAutoApproved(serverType: string, toolName: string): boolean;

  /** Toggle the persisted "always-allow" flag. */
  setAutoApproved(serverType: string, toolName: string, value: boolean): void;

  /** Cancel any in-flight provider stream. */
  stop?(): void;
}

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
 */
export type AIEngineDeps = {
  storage: StorageAdapter;
  assignments?: AssignmentsEngine;
  threads?: ThreadsEngine;
  toolDispatcher?: ToolDispatcher;
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
 * Identifies a pending tool call inside an assistant message. Carried
 * alongside `tool-call-pending` and `tool-call-executed` events so the
 * UI can route the user's approve / deny / continue decision back to
 * the engine.
 */
export type ToolCallData = {
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
 * `allowAlways` persists the auto-approve flag for the (server, tool)
 * pair via the {@link ToolDispatcher}. `modifiedArgs` lets the UI
 * patch tool arguments after a `beforeToolCall` middleware ran on the
 * client. After approval the engine emits `tool-call-executed` and
 * waits for {@link AIEngine.continueAfterToolCall}.
 */
export type ApproveToolCallInput = ToolCallData & {
  allowAlways: boolean;
  /** Optional rewrite of the tool's arguments produced by client middleware. */
  modifiedArgs?: Record<string, unknown>;
  isReasoning?: boolean;
  signal?: AbortSignal;
  tools?: TMCPItem[];
};

/**
 * Payload for {@link AIEngine.denyToolCall}.
 *
 * Skips dispatch entirely — the tool result is replaced with
 * `"User deny tool call"` and the chat resumes immediately with no
 * `tool-call-executed` round-trip.
 */
export type DenyToolCallInput = ToolCallData & {
  isReasoning?: boolean;
  signal?: AbortSignal;
  tools?: TMCPItem[];
};

/**
 * Payload for {@link AIEngine.continueAfterToolCall}.
 *
 * Sent by the UI after it received a `tool-call-executed` event and
 * (optionally) ran an `afterToolResult` middleware on the result.
 * `result` is the value the model will see; the engine persists it
 * onto the assistant message and resumes the chat with the augmented
 * history.
 */
export type ContinueAfterToolCallInput = ToolCallData & {
  result: unknown;
  isReasoning?: boolean;
  signal?: AbortSignal;
  tools?: TMCPItem[];
};

/**
 * Discriminated event emitted by the streaming methods of
 * {@link AIEngine}. The engine never invokes user-supplied middleware
 * or callbacks directly — every observable side-effect is encoded as
 * a {@link ChatEvent} so the same stream can be replayed over SSE,
 * WebSocket, or in-process.
 *
 * Pause points (the UI is expected to take some action before the
 * stream proceeds):
 *
 * - `tool-call-pending` — UI must run `beforeToolCall` middleware
 *   then call {@link AIEngine.approveToolCall} or
 *   {@link AIEngine.denyToolCall}.
 * - `tool-call-executed` — UI must run `afterToolResult` middleware
 *   then call {@link AIEngine.continueAfterToolCall} (or stop the
 *   stream).
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
    }
  | {
      type: "tool-call-executed";
      message: ThreadMessageLike;
      idx: number;
      messageId: string;
      threadId: string;
      toolName: string;
      result: unknown;
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
