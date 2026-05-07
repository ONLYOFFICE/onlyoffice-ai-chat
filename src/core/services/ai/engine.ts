import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import {
  extractRefIdsFromMessage,
  resolveAttachmentRefs,
} from "../../actions/attachment-resolution";
import { AttachmentsEngine } from "../attachments";
import { chat } from "../../actions/chat";
import { generateTitle } from "../../actions/title";
import type { ActionArgs } from "../../actions/types";
import { AssignmentsEngine } from "../assignments";
import { ThreadsEngine } from "../threads";
import { drainToFinal, runSync } from "./actions";
import { runCustomOnce, runCustomStream } from "./custom";
import { processStream } from "./stream";
import { readToolCall, resumeChat } from "./tool-call";
import {
  type AdapterRunContext,
  buildToolContext,
  executeAdapterTool,
  resolveToolSource,
  type ToolContext,
} from "./tools";
import type {
  AIEngineDeps,
  ApproveToolCallInput,
  ChatEvent,
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
 * Tool-call lifecycle:
 *
 * - **Adapter tools** (contributed by {@link ToolsAdapter}) are
 *   executed in-engine by {@link executeAdapterTool}; the chat resumes
 *   automatically without surfacing a pause to the consumer.
 * - **User tools** (from `actionArgs.tools`) yield `tool-call-pending`
 *   to the consumer with an `autoAllow` flag derived from
 *   `storage.toolPrefs.readAllowAlways()`. The consumer dispatches the
 *   tool itself and resumes via {@link approveToolCall} (with the
 *   result) or {@link denyToolCall} (no result — engine writes
 *   `"User deny tool call"`).
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

  private readonly attachments: AttachmentsEngine;

  constructor(deps: AIEngineDeps) {
    this.deps = deps;
    this.assignments =
      deps.assignments ?? new AssignmentsEngine({ storage: deps.storage });
    this.threads =
      deps.threads ?? new ThreadsEngine({ storage: deps.storage });
    this.attachments = new AttachmentsEngine({ storage: deps.storage });
  }

  async *sendWithStream(input: SendStreamInput): AsyncGenerator<ChatEvent> {
    const { profileId, profile } = await this.assignments.resolveForAction(
      ActionType.Chat,
      input.entityId
    );

    let threadId = input.threadId ?? "";
    let titlePromise: Promise<string> | null = null;
    let priorMessages: ThreadMessageLike[] = [];
    const isNewThread = !threadId;

    if (!isNewThread) {
      priorMessages = await this.deps.storage.messages.readByThread(threadId);
      const messageId = await this.threads.appendUserMessage(
        threadId,
        input.userMessage,
        profileId
      );
      await this.attachments.linkToMessage(
        extractRefIdsFromMessage(input.userMessage),
        messageId,
        threadId
      );
    } else {
      // Create the thread up-front with a placeholder title so the stream
      // has a stable id to persist messages against. Generate the real
      // title in parallel and yield it once both the title and the
      // assistant reply have settled.
      const placeholder = await this.deps.storage.threads.create(
        "New chat",
        profileId,
        input.entityId
      );
      threadId = placeholder.threadId;
      const stored = await this.deps.storage.messages.create(
        threadId,
        input.userMessage
      );
      if (stored.id) {
        await this.attachments.linkToMessage(
          extractRefIdsFromMessage(input.userMessage),
          stored.id,
          threadId
        );
      }

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

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      input.entityId
    );

    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: await resolveAttachmentRefs(
        [...priorMessages, input.userMessage],
        this.deps.storage.attachments
      ),
      tools: toolCtx.mergedTools,
    };

    const stream = processStream(chat(actionArgs), {
      storage: this.deps.storage,
      threadId,
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: input.entityId,
    });

    yield* this.runChatStream(stream, toolCtx, {
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: input.entityId,
    });

    if (titlePromise) {
      const title = await titlePromise;
      await this.deps.storage.threads.update(threadId, title);
      yield { type: "thread-title", threadId, title, profileId };
    }
  }

  /**
   * Resume the chat after the consumer has executed the tool. The
   * supplied `result` is persisted onto the assistant message that
   * issued the call, and a fresh `processStream` is started with the
   * augmented history. The consumer (UI) is responsible for the actual
   * tool dispatch and for any `beforeToolCall` / `afterToolResult`
   * middleware.
   */
  async *approveToolCall(input: ApproveToolCallInput): AsyncGenerator<ChatEvent> {
    if (input.allowAlways) {
      const toolCall = readToolCall(input.message, input.idx);
      if (toolCall) {
        const current = await this.deps.storage.toolPrefs.readAllowAlways(
          input.entityId
        );
        if (!current.includes(toolCall.toolName)) {
          await this.deps.storage.toolPrefs.upsertAllowAlways(
            [...current, toolCall.toolName],
            input.entityId
          );
        }
      }
    }

    yield* this.resumeAndContinue(input, input.result);
  }

  /**
   * Deny the pending tool call and resume the chat immediately with
   * `"User deny tool call"` as the result.
   */
  async *denyToolCall(input: DenyToolCallInput): AsyncGenerator<ChatEvent> {
    yield* this.resumeAndContinue(input, "User deny tool call");
  }

  /**
   * Persist `result`, resume the provider stream, and run it through
   * {@link runChatStream} so adapter-served tools that surface in the
   * follow-up rounds keep being auto-executed in-engine instead of
   * leaking out to the UI as `tool-call-pending`. Shared by
   * {@link approveToolCall} and {@link denyToolCall}.
   */
  private async *resumeAndContinue(
    input: DenyToolCallInput,
    result: unknown
  ): AsyncGenerator<ChatEvent> {
    const { profile, profileId } = await this.assignments.resolveForAction(
      ActionType.Chat,
      input.entityId
    );

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      input.entityId
    );
    const runCtx: AdapterRunContext = {
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: input.entityId,
    };

    const resumed = resumeChat(
      { storage: this.deps.storage },
      {
        threadId: input.threadId,
        messageId: input.messageId,
        idx: input.idx,
        message: input.message,
        result,
        profile,
        profileId,
        isReasoning: input.actionArgs?.isReasoning,
        signal: input.actionArgs?.signal,
        tools: toolCtx.mergedTools,
        entityId: input.entityId,
      }
    );

    yield* this.runChatStream(resumed, toolCtx, runCtx);
  }

  /**
   * Drain a chat stream, intercepting `tool-call-pending` events whose
   * tool was contributed by the {@link ToolsAdapter}: those tools are
   * executed in-engine via {@link executeAdapterTool}, and the chat is
   * resumed with the result without going through the UI approve / deny
   * round-trip. Tools sourced from `actionArgs.tools` (or unrecognized
   * names) are forwarded untouched so the UI can run its
   * `beforeToolCall` middleware.
   */
  private async *runChatStream(
    stream: AsyncGenerator<ChatEvent>,
    toolCtx: ToolContext,
    runCtx: AdapterRunContext
  ): AsyncGenerator<ChatEvent> {
    for await (const event of stream) {
      if (event.type === "tool-call-pending") {
        const toolCall = readToolCall(event.message, event.idx);
        const source = resolveToolSource(
          toolCall?.toolName ?? null,
          toolCtx.userToolNames,
          toolCtx.adapterToolNames
        );

        if (source === "adapter" && toolCall) {
          const resumed = executeAdapterTool(
            this.deps.storage,
            this.deps.toolsAdapter,
            event,
            runCtx
          );
          yield* this.runChatStream(resumed, toolCtx, runCtx);
          return;
        }
      }
      yield event;
    }
  }

  async send(input: SendInput): Promise<ThreadMessageLike> {
    const { profile } = await this.assignments.resolveForAction(
      input.actionType,
      input.entityId
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


