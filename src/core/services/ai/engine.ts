import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { chat } from "../../actions/chat";
import { generateTitle } from "../../actions/title";
import type { ActionArgs } from "../../actions/types";
import { AssignmentsEngine } from "../assignments";
import { ThreadsEngine } from "../threads";
import { drainToFinal, runSync } from "./actions";
import { runCustomOnce, runCustomStream } from "./custom";
import { processStream } from "./stream";
import {
  executeToolCall,
  replaceContentPart,
  resumeChat,
} from "./tool-call";
import type {
  AIEngineDeps,
  ApproveToolCallInput,
  ChatEvent,
  ContinueAfterToolCallInput,
  DenyToolCallInput,
  SendCustomInput,
  SendInput,
  SendStreamInput,
} from "./types";

/**
 * Thin orchestrator that binds the AI actions layer to a
 * {@link StorageAdapter} via the {@link AssignmentsEngine} and
 * {@link ThreadsEngine} sub-engines.
 *
 * The engine is **transport-agnostic and middleware-free**: every
 * observable event is encoded as a {@link ChatEvent} on the returned
 * `AsyncGenerator`. User middleware (`beforeSend`, `onStreamChunk`,
 * `beforeToolCall`, `afterToolResult`, `beforeDisplay`, `onError`)
 * and UI callbacks live with the consumer of the stream — typically
 * the browser, even when the engine itself runs server-side.
 *
 * Tool-call lifecycle is two-phase to give the UI a chance to apply
 * `beforeToolCall` and `afterToolResult` middleware:
 *
 * 1. {@link sendWithStream} streams up to a `tool-call-pending` and
 *    stops.
 * 2. UI runs `beforeToolCall`, then calls
 *    {@link approveToolCall} / {@link denyToolCall}.
 * 3. {@link approveToolCall} dispatches the tool and emits
 *    `tool-call-executed`, then stops.
 * 4. UI runs `afterToolResult`, then calls
 *    {@link continueAfterToolCall} with the (optionally rewritten)
 *    result. Chat resumes.
 * 5. {@link denyToolCall} skips both round-trips and resumes the
 *    chat with `"User deny tool call"`.
 *
 * Other entry points:
 *
 * - {@link send} — any `ActionType`. One-shot: resolve the profile,
 *   invoke the action on a single message, return the response. No
 *   thread, no history, no persistence.
 * - {@link sendCustom} — free-form one-turn call with a caller-supplied
 *   system prompt against the `Default` profile. Mode (stream vs
 *   one-shot) chosen at call time via `isStream`.
 */
export class AIEngine {
  private readonly deps: AIEngineDeps;
  private readonly assignments: AssignmentsEngine;
  private readonly threads: ThreadsEngine;

  constructor(deps: AIEngineDeps) {
    this.deps = deps;
    this.assignments =
      deps.assignments ?? new AssignmentsEngine({ storage: deps.storage });
    this.threads =
      deps.threads ?? new ThreadsEngine({ storage: deps.storage });
  }

  async *sendWithStream(input: SendStreamInput): AsyncGenerator<ChatEvent> {
    const { profileId, profile } = await this.assignments.resolveForAction(
      ActionType.Chat
    );

    let threadId = input.threadId ?? "";
    let titlePromise: Promise<string> | null = null;
    let priorMessages: ThreadMessageLike[] = [];
    const isNewThread = !threadId;

    if (!isNewThread) {
      priorMessages = await this.deps.storage.messages.readByThread(threadId);
      await this.threads.appendUserMessage(
        threadId,
        input.userMessage,
        profileId
      );
    } else {
      // Create the thread up-front with a placeholder title so the stream
      // has a stable id to persist messages against. Generate the real
      // title in parallel and yield it once both the title and the
      // assistant reply have settled.
      const placeholder = await this.deps.storage.threads.create(
        "New chat",
        profileId
      );
      threadId = placeholder.threadId;
      await this.deps.storage.messages.create(threadId, input.userMessage);

      // Surface the placeholder thread to the UI immediately so it shows up
      // in the threads list and the active threadId switches over before the
      // assistant reply starts streaming. The real title arrives in a second
      // `thread-title` event once `generateTitle` resolves.
      yield {
        type: "thread-title",
        threadId,
        title: "New chat",
        profileId,
      };

      titlePromise = generateTitle({
        profile,
        messages: [input.userMessage],
      })
        .then((t) => t || "New chat")
        .catch(() => "New chat");
    }

    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: [...priorMessages, input.userMessage],
    };

    yield* processStream(chat(actionArgs), {
      storage: this.deps.storage,
      threadId,
      profile,
      profileId,
      dispatcher: this.deps.toolDispatcher,
      tools: input.actionArgs?.tools,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
    });

    if (titlePromise) {
      const title = await titlePromise;
      await this.deps.storage.threads.update(threadId, title);
      yield { type: "thread-title", threadId, title, profileId };
    }
  }

  /**
   * Approve a pending tool call. Optionally persists the auto-approve
   * flag and applies `modifiedArgs` (typically produced by the UI's
   * `beforeToolCall` middleware). Dispatches the tool through
   * {@link ToolDispatcher.callTool}, then yields a `tool-call-executed`
   * event and stops — the caller must follow up with
   * {@link continueAfterToolCall} once `afterToolResult` middleware
   * has run.
   */
  async *approveToolCall(input: ApproveToolCallInput): AsyncGenerator<ChatEvent> {
    const original = readToolCallPart(input.message, input.idx);

    if (input.allowAlways && this.deps.toolDispatcher && original) {
      const serverType = this.deps.toolDispatcher.getServerType(
        original.toolName
      );
      const bareName = original.toolName.replace(`${serverType}_`, "");
      this.deps.toolDispatcher.setAutoApproved(serverType, bareName, true);
    }

    let message = input.message;
    if (input.modifiedArgs && original) {
      message = replaceContentPart(message, input.idx, {
        ...original,
        args: input.modifiedArgs,
      });
      await this.deps.storage.messages.update(input.messageId, message);
    }

    yield* executeToolCall(
      { storage: this.deps.storage, dispatcher: this.deps.toolDispatcher },
      {
        threadId: input.threadId,
        messageId: input.messageId,
        idx: input.idx,
        message,
      }
    );
  }

  /**
   * Deny the pending tool call and resume the chat immediately with
   * `"User deny tool call"` as the result. Skips both `tool-call-pending`
   * approval and the `tool-call-executed` round-trip — denial is not
   * considered a value the model could meaningfully transform.
   */
  async *denyToolCall(input: DenyToolCallInput): AsyncGenerator<ChatEvent> {
    const { profile, profileId } = await this.assignments.resolveForAction(
      ActionType.Chat
    );

    yield* resumeChat(
      { storage: this.deps.storage, dispatcher: this.deps.toolDispatcher },
      {
        threadId: input.threadId,
        messageId: input.messageId,
        idx: input.idx,
        message: input.message,
        result: "User deny tool call",
        profile,
        profileId,
        isReasoning: input.isReasoning,
        signal: input.signal,
        tools: input.tools,
      }
    );
  }

  /**
   * Continue the chat after the UI has applied its `afterToolResult`
   * middleware to the result surfaced by `tool-call-executed`. The
   * `result` carried in `input` is the final value the model will see.
   */
  async *continueAfterToolCall(
    input: ContinueAfterToolCallInput
  ): AsyncGenerator<ChatEvent> {
    const { profile, profileId } = await this.assignments.resolveForAction(
      ActionType.Chat
    );

    yield* resumeChat(
      { storage: this.deps.storage, dispatcher: this.deps.toolDispatcher },
      {
        threadId: input.threadId,
        messageId: input.messageId,
        idx: input.idx,
        message: input.message,
        result: input.result,
        profile,
        profileId,
        isReasoning: input.isReasoning,
        signal: input.signal,
        tools: input.tools,
      }
    );
  }

  /** Cancel any in-flight provider stream via the dispatcher's `stop` hook. */
  stop(): void {
    this.deps.toolDispatcher?.stop?.();
  }

  async send(input: SendInput): Promise<ThreadMessageLike> {
    const { profile } = await this.assignments.resolveForAction(
      input.actionType
    );
    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: [input.userMessage],
    };

    return input.actionType === ActionType.Chat
      ? drainToFinal(chat(actionArgs))
      : runSync(input.actionType, actionArgs);
  }

  sendCustom(
    input: SendCustomInput
  ): AsyncGenerator<SendMessageResult> | Promise<ThreadMessageLike> {
    return input.isStream
      ? runCustomStream(this.assignments, input)
      : runCustomOnce(this.assignments, input);
  }
}

function readToolCallPart(
  message: ThreadMessageLike,
  idx: number
):
  | { type: "tool-call"; toolName: string; args?: Record<string, unknown> }
  | null {
  if (!Array.isArray(message.content)) return null;
  const part = message.content[idx] as unknown;
  if (
    !part ||
    typeof part !== "object" ||
    !("type" in part) ||
    (part as { type?: string }).type !== "tool-call"
  ) {
    return null;
  }
  return part as {
    type: "tool-call";
    toolName: string;
    args?: Record<string, unknown>;
  };
}
