import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { SourceResolver } from "../../../shared/source-meta";
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
  sendWithStreamOpenAI: {
    method: "POST",
    path: "ai/send-with-stream-openai",
  },
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

  /**
   * Server-type keys (the `getTools` grouping keys) that belong to a
   * server-side "system" tool source. Their tools are adapter-served
   * (executed in-engine) but, unlike other adapter tools, they pause on
   * `tool-call-pending` for UI approval instead of running silently —
   * the engine still executes them server-side once approved. Tools in
   * the persisted "always-allow" list skip the prompt. Pass a function
   * to resolve lazily (e.g. `() => systemSource.getServerTypes()`).
   */
  systemServerTypes?: string[] | (() => string[]);

  /**
   * Custom fetch used in place of the global one whenever the resolved
   * profile has `useProxy: true`. The engine wires this into every
   * provider request (chat / title / regenerate / resume) for that
   * profile. Typically the host's `PlatformAdapter.fetchProxy`.
   */
  fetchProxy?: import("../../../shared/provider-credentials").ProviderFetch;

  /**
   * Global override that routes EVERY non-`"external"` provider request
   * through {@link fetchProxy}, regardless of each profile's
   * {@link Profile.useProxy} flag. Intended for server-side deployments
   * that must funnel all upstream traffic through the document-server
   * proxy. Has no effect when {@link fetchProxy} is not supplied; the
   * `"external"` provider still uses {@link externalFetch}. Pass a
   * function to resolve lazily at request time.
   */
  forceProxy?: boolean | (() => boolean);

  /**
   * Transport hook for the `"external"` provider. Required for any
   * profile with `providerType: "external"`; the engine wires it into
   * every provider request for such profiles, independent of
   * `useProxy`. Typically the host's `PlatformAdapter.externalFetch`.
   */
  externalFetch?: import("../../../shared/provider-credentials").ProviderFetch;

  /**
   * Transport override for the built-in `web_search` / `web_crawling`
   * tools. When omitted the engine keeps its historical behavior and
   * routes them through {@link fetchProxy}. Hosts whose web-search
   * provider lives behind their own bridge (e.g. the editor plugin's
   * `externalFetch` connector transport) pass that fetch here — web
   * search is not profile-scoped, so it never goes through the
   * per-profile `pickFetch` selection.
   */
  webSearchFetch?: import("../../../shared/provider-credentials").ProviderFetch;

  /**
   * Host opt-out for the built-in `generate_image` chat tool. When true,
   * the tool is never exposed to the model, so a host that ships its own
   * image-generation tool isn't forced to surface two same-purpose tools.
   * Default false (the tool is offered whenever an `ImageGeneration`
   * profile is assigned). Gates ONLY the chat tool — the one-shot
   * {@link ActionType.ImageGeneration} action is unaffected. Pass a
   * function to resolve lazily at request time.
   */
  disableBuiltinImageTool?: boolean | (() => boolean);

  /**
   * Global cursor-pagination switch. When enabled, every full-history
   * read the engine performs (`sendWithStream` / `regenerateStream` /
   * tool-call resume) fetches `storage.messages.readByThread` in pages
   * of {@link PAGE_SIZE} instead of one unbounded call. The model still
   * receives the complete history — only the size of each storage
   * request is capped. Default false (unbounded reads, the
   * pre-pagination behavior). Pass a function to resolve lazily at
   * request time.
   */
  pagination?: boolean | (() => boolean);

  /**
   * How often a streaming assistant message is flushed to storage, in
   * milliseconds. See `ProcessStreamContext.persistIntervalMs`. Defaults
   * to 150 (`DEFAULT_PERSIST_INTERVAL_MS`), which suits a local adapter;
   * a host whose adapter is a remote HTTP hop should raise it to a few
   * seconds.
   */
  persistIntervalMs?: number;

  /**
   * Names the entry a round is billed to — see {@link SourceResolver}.
   * Called once per entry point with the round's context scope and thread;
   * the answer travels into every provider request of the round (chat,
   * tool-call resume rounds, title generation, the built-in image tool) and
   * into the built-in web-search requests as the `metadata` object. When
   * wired, a caller-supplied `actionArgs.source` is ignored. Forwarded to
   * the engine's own {@link ThreadsEngine} unless one is injected.
   */
  resolveSource?: SourceResolver;
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

  /**
   * Optional secondary scope for the round's *context*, used when the
   * conversation itself lives elsewhere: the tool list / execution scope,
   * the allow-always tool preferences, and the assignment fallback resolve
   * against this value, while the thread stays placed under `entityId`.
   * Hosts use it to talk to an agent (its tools, workspace and model
   * fallback) from a conversation stored outside the agent — e.g. the
   * global history. Falls back to `entityId` when omitted.
   */
  contextEntityId?: string;

  /**
   * Session-level profile override. When set, the engine uses this
   * profile for the current request without mutating the persisted
   * `Chat` assignment — used by the UI to honor an ad-hoc model pick
   * from the chat composer. Falls back to the assignment if the id no
   * longer exists in storage.
   */
  profileId?: string;
};

/**
 * Payload for {@link AIEngine.regenerateStream}. The engine drops every
 * trailing message after the user message being re-rolled (the previous
 * assistant reply plus any tool-call hops) and streams a fresh reply
 * against that unchanged user prompt. The thread must already exist —
 * regenerate only operates on persisted history.
 */
export type RegenerateStreamInput = {
  /** Target thread (must exist). */
  threadId: string;

  /**
   * The user message to re-roll from. Everything stored after it is
   * dropped, so regenerating an older turn rewinds the thread to that
   * point instead of re-rolling the newest reply. Omitted (or no longer
   * present in the thread) → the last user message, the pre-existing
   * behavior.
   *
   * Callers that render optimistically may hold a client-side id the
   * storage layer never saw; {@link keepCount} covers that case.
   */
  messageId?: string;

  /**
   * How many messages from the start of the thread to keep, used when
   * `messageId` cannot be resolved against storage. The message at
   * `keepCount - 1` must be the user turn to re-roll; everything after
   * it is dropped. Ignored when it does not land on a user message, so
   * a stale count degrades to the last-user-message fallback rather
   * than re-rolling from the wrong turn.
   */
  keepCount?: number;

  /** Forwarded to the underlying action. `profile` and `messages` are owned by the engine. */
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;

  /**
   * Opaque scope token forwarded to
   * {@link AssignmentsEngine.resolveForAction} (so the storage layer
   * can return an entity-specific Chat profile).
   */
  entityId?: string;

  /** Secondary context scope — see {@link SendStreamInput.contextEntityId}. */
  contextEntityId?: string;

  /**
   * Session-level profile override — see {@link SendStreamInput.profileId}.
   */
  profileId?: string;
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

  /** Secondary context scope — see {@link SendStreamInput.contextEntityId}. */
  contextEntityId?: string;
};

/**
 * Payload for {@link AIEngine.sendCustom}. Free-form one-turn call with
 * a caller-supplied system prompt. No thread, no history, no
 * persistence.
 *
 * The profile is chosen the same way as a chat round: when `profileId`
 * is supplied and live it wins, otherwise the request falls back to the
 * `Default` assignment slot.
 *
 * `isStream` toggles between streaming and one-shot modes; method
 * overloads narrow the return type accordingly.
 */
export type SendCustomInput = {
  isStream: boolean;
  systemPrompt: string;
  userMessage: ThreadMessageLike;
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;

  /**
   * Explicit profile to run this call against. Mirrors
   * {@link SendStreamInput.profileId}: when set and resolvable it is
   * loaded directly from storage and wins over the `Default` slot for
   * this request only. Falls back to `Default` when omitted or when the
   * id is not found.
   */
  profileId?: string;
};

/**
 * Identifies a pending tool call inside an assistant message and
 * carries the same `actionArgs` envelope as {@link SendStreamInput} so
 * the resume round (after approve / deny) sees the same prompts,
 * abort signal, `isReasoning` flag, and tool list as the original
 * `sendWithStream` request.
 */
export type ToolCallData = Pick<
  SendStreamInput,
  "actionArgs" | "entityId" | "contextEntityId" | "profileId"
> & {
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
      /**
       * Emitted once per `sendWithStream` call, immediately after the
       * user message has been persisted by storage and before the
       * assistant stream starts. Carries the storage-assigned `id` and
       * `createdAt`. The UI uses it to render the user bubble — no
       * client-side optimistic placeholder is needed, which keeps the
       * runtime tree free of phantom nodes from index-fallback ids.
       */
      type: "user-message-stored";
      message: ThreadMessageLike;
      messageId: string;
    }
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
      /**
       * The terminal message carries `status: { type: "incomplete",
       * reason, error?: ChatErrorPayload }`. When `reason === "error"`,
       * `error` is always a serializable {@link ChatErrorPayload} —
       * raw `Error` instances are normalized by the engine before the
       * event is yielded so the wire JSON-stringifies cleanly.
       */
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
       * The consumer should execute the tool without prompting the user.
       * True when the tool is in the persisted "always-allow" list, or the
       * tool itself opts in via `TMCPItem.requireApproval === false` (host
       * tools default to this). For a client-side tool with a server-side
       * engine, this lets the engine return the pending call already
       * flagged auto-allow so the client runs it and streams the result
       * back without a dialog round-trip.
       */
      autoAllow: boolean;
      /**
       * Set when the tool is served by a server-side system source: the
       * consumer must NOT execute it locally — only show the approval UI
       * (unless `autoAllow`) and resume via `approveToolCall` (no
       * `result` needed) / `denyToolCall`. The engine runs it in-engine.
       */
      serverExecuted?: boolean;
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
