import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import {
  collectRefIds,
  extractRefIdsFromMessage,
  resolveAttachmentRefs,
} from "../../actions/attachment-resolution";
import { AttachmentsEngine } from "../attachments";
import { chat } from "../../actions/chat";
import { generateTitle } from "../../actions/title";
import type { ActionArgs } from "../../actions/types";
import { AssignmentsEngine } from "../assignments";
import type { ResolvedAssignment } from "../assignments/types";
import { ThreadsEngine } from "../threads";
import { drainToFinal, runSync } from "./actions";
import { runCustomOnce, runCustomStream } from "./custom";
import {
  type OpenAIStreamChunk,
  toOpenAIChatCompletionStream,
} from "./openai-format";
import {
  hasSendableContent,
  processStream,
  stripUnresolvedToolCalls,
} from "./stream";
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
  RegenerateStreamInput,
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
    this.threads = deps.threads ?? new ThreadsEngine({ storage: deps.storage });
    this.attachments = new AttachmentsEngine({ storage: deps.storage });
  }

  /** Resolve the configured system-source server types (lazy or static). */
  private getSystemServerTypes(): string[] {
    const value = this.deps.systemServerTypes;
    return typeof value === "function" ? value() : (value ?? []);
  }

  /** Resolve the global `forceProxy` switch (lazy or static). */
  private isProxyForced(): boolean {
    const value = this.deps.forceProxy;
    return typeof value === "function" ? value() : (value ?? false);
  }

  /**
   * Resolve the custom fetch (if any) to wire into the provider
   * request for the given profile. Two independent code paths:
   *
   * - `providerType === "external"` — the External provider has no
   *   transport of its own; the engine **must** supply
   *   {@link PlatformAdapter.externalFetch} as `creds.fetch`. Throws a
   *   clear error when the dep wasn't configured, so the failure
   *   surfaces as a normal request error instead of an opaque network
   *   crash inside the inner SDK.
   *
   * - Any other provider — the per-profile `Profile.useProxy` flag, OR
   *   the global {@link AIEngineDeps.forceProxy} switch, opts into
   *   {@link PlatformAdapter.fetchProxy}; otherwise the SDK uses the
   *   global `fetch`.
   */
  private pickFetch(profile: {
    providerType?: string;
    useProxy?: boolean;
  }): import("../../../shared/provider-credentials").ProviderFetch | undefined {
    if (profile.providerType === "external") {
      if (!this.deps.externalFetch) {
        throw new Error(
          'PlatformAdapter.externalFetch is required for profiles with providerType: "external"'
        );
      }
      return this.deps.externalFetch;
    }
    return profile.useProxy || this.isProxyForced()
      ? this.deps.fetchProxy
      : undefined;
  }

  /**
   * Resolve the profile to use for a chat round. If `overrideId` is
   * supplied (the UI's session-level model pick from the composer), load
   * it directly from storage — that pick wins over the persisted Chat
   * assignment for the current request without mutating the assignment.
   * Falls back to {@link AssignmentsEngine.resolveForAction} when no
   * override is given or the override id no longer exists.
   */
  private async resolveChatProfile(
    overrideId: string | undefined,
    entityId: string | undefined
  ): Promise<ResolvedAssignment> {
    if (overrideId) {
      const profile = await this.deps.storage.profiles.readById(overrideId);
      if (profile) return { profileId: overrideId, profile };
    }
    return this.assignments.resolveForAction(ActionType.Chat, entityId);
  }

  async *sendWithStream(input: SendStreamInput): AsyncGenerator<ChatEvent> {
    const { profileId, profile } = await this.resolveChatProfile(
      input.profileId,
      input.entityId
    );

    let threadId = input.threadId ?? "";
    let titlePromise: Promise<string> | null = null;
    let priorMessages: ThreadMessageLike[] = [];
    const isNewThread = !threadId;

    let storedUserMessage: ThreadMessageLike | null = null;

    if (!isNewThread) {
      priorMessages = stripUnresolvedToolCalls(
        await this.deps.storage.messages.readByThread(threadId)
      ).filter(hasSendableContent);
      storedUserMessage = await this.threads.appendUserMessage(
        threadId,
        input.userMessage,
        profileId
      );
      const messageId = storedUserMessage.id!;
      await this.attachments.linkToMessage(
        extractRefIdsFromMessage(input.userMessage),
        messageId,
        threadId
      );
      yield {
        type: "user-message-stored",
        message: storedUserMessage,
        messageId,
      };
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
      storedUserMessage = stored;
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

      if (stored.id) {
        yield {
          type: "user-message-stored",
          message: stored,
          messageId: stored.id,
        };
      }

      titlePromise = generateTitle({
        profile,
        messages: [input.userMessage],
        fetch: this.pickFetch(profile),
      })
        .then((t) => t || "New chat")
        .catch(() => "New chat");
    }

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      input.entityId,
      {
        attachmentId: collectRefIds([...priorMessages, input.userMessage]),
      },
      this.getSystemServerTypes()
    );

    const proxiedFetch = this.pickFetch(profile);

    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: await resolveAttachmentRefs(
        [...priorMessages, input.userMessage],
        this.deps.storage.attachments
      ),
      tools: toolCtx.mergedTools,
      fetch: proxiedFetch,
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
      fetch: proxiedFetch,
      webSearchFetch: this.deps.fetchProxy,
      pickFetch: (p) => this.pickFetch(p),
    });

    if (titlePromise) {
      const title = await titlePromise;
      await this.deps.storage.threads.update(threadId, title);
      yield { type: "thread-title", threadId, title, profileId };
    }
  }

  /**
   * Same chat round as {@link sendWithStream}, re-encoded as an
   * OpenAI Chat Completions stream (`chat.completion.chunk` objects).
   * Lets a host expose an OpenAI-compatible `POST /v1/chat/completions`
   * (`stream: true`) endpoint backed by the in-app pipeline: storage,
   * title generation, tool-call pauses, and middleware-free events are
   * identical — only the wire shape differs. Tool calls terminate the
   * stream with `finish_reason: "tool_calls"`, mirroring OpenAI's own
   * tool-calling protocol. See {@link toOpenAIChatCompletionStream}.
   */
  async *sendWithStreamOpenAI(
    input: SendStreamInput
  ): AsyncGenerator<OpenAIStreamChunk> {
    const { profile } = await this.resolveChatProfile(
      input.profileId,
      input.entityId
    );
    yield* toOpenAIChatCompletionStream(this.sendWithStream(input), {
      model: profile.modelId,
    });
  }

  /**
   * Re-roll the last assistant reply in an existing thread. Drops every
   * trailing message after the last user message (the previous reply
   * plus any tool-call hops), persists the deletion, and streams a
   * fresh reply against the unchanged user prompt. Skips title
   * generation and thread creation — the thread must already exist.
   */
  async *regenerateStream(
    input: RegenerateStreamInput
  ): AsyncGenerator<ChatEvent> {
    const { profileId, profile } = await this.resolveChatProfile(
      input.profileId,
      input.entityId
    );

    const stored = await this.deps.storage.messages.readByThread(
      input.threadId
    );

    let lastUserIdx = -1;
    for (let i = stored.length - 1; i >= 0; i--) {
      if (stored[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;

    const tail = stored.slice(lastUserIdx + 1);
    for (const m of tail) {
      if (m.id) await this.deps.storage.messages.delete(m.id);
    }

    const priorMessages = stripUnresolvedToolCalls(
      stored.slice(0, lastUserIdx + 1)
    ).filter(hasSendableContent);

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      input.entityId,
      { attachmentId: collectRefIds(priorMessages) },
      this.getSystemServerTypes()
    );

    const proxiedFetch = this.pickFetch(profile);

    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: await resolveAttachmentRefs(
        priorMessages,
        this.deps.storage.attachments
      ),
      tools: toolCtx.mergedTools,
      fetch: proxiedFetch,
    };

    const stream = processStream(chat(actionArgs), {
      storage: this.deps.storage,
      threadId: input.threadId,
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
      fetch: proxiedFetch,
      webSearchFetch: this.deps.fetchProxy,
      pickFetch: (p) => this.pickFetch(p),
    });
  }

  /**
   * Resume the chat after the consumer has executed the tool. The
   * supplied `result` is persisted onto the assistant message that
   * issued the call, and a fresh `processStream` is started with the
   * augmented history. The consumer (UI) is responsible for the actual
   * tool dispatch and for any `beforeToolCall` / `afterToolResult`
   * middleware.
   */
  async *approveToolCall(
    input: ApproveToolCallInput
  ): AsyncGenerator<ChatEvent> {
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

    // System (server-executed) tools: the consumer ran nothing — execute
    // the tool in-engine and resume, ignoring any client-supplied result.
    // Skipped entirely when no system source is configured (no overhead).
    const systemServerTypes = this.getSystemServerTypes();
    if (systemServerTypes.length > 0) {
      const toolCall = readToolCall(input.message, input.idx);
      if (toolCall) {
        const { profile, profileId } = await this.resolveChatProfile(
          input.profileId,
          input.entityId
        );
        const toolCtx = await buildToolContext(
          this.deps.storage,
          this.deps.toolsAdapter,
          input.actionArgs?.tools ?? [],
          input.entityId,
          undefined,
          systemServerTypes
        );
        if (toolCtx.systemToolNames.has(toolCall.toolName)) {
          const proxiedFetch = this.pickFetch(profile);
          const runCtx: AdapterRunContext = {
            profile,
            profileId,
            tools: toolCtx.mergedTools,
            isReasoning: input.actionArgs?.isReasoning,
            signal: input.actionArgs?.signal,
            entityId: input.entityId,
            fetch: proxiedFetch,
            webSearchFetch: this.deps.fetchProxy,
            pickFetch: (p) => this.pickFetch(p),
          };
          const resumed = executeAdapterTool(
            this.deps.storage,
            this.deps.toolsAdapter,
            {
              type: "tool-call-pending",
              message: input.message,
              idx: input.idx,
              messageId: input.messageId,
              threadId: input.threadId,
              autoAllow: false,
            },
            runCtx
          );
          yield* this.runChatStream(resumed, toolCtx, runCtx);
          return;
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
    const { profile, profileId } = await this.resolveChatProfile(
      input.profileId,
      input.entityId
    );

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      input.entityId,
      undefined,
      this.getSystemServerTypes()
    );
    const proxiedFetch = this.pickFetch(profile);
    const runCtx: AdapterRunContext = {
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: input.entityId,
      fetch: proxiedFetch,
      webSearchFetch: this.deps.fetchProxy,
      pickFetch: (p) => this.pickFetch(p),
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
        fetch: proxiedFetch,
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
          // System tools execute server-side but must be approved in the
          // UI first (unless already always-allowed). Everything else
          // adapter-served (web-search, image-gen, host adapter) runs
          // silently in-engine as before.
          const needsApproval =
            toolCtx.systemToolNames.has(toolCall.toolName) && !event.autoAllow;

          if (!needsApproval) {
            const resumed = executeAdapterTool(
              this.deps.storage,
              this.deps.toolsAdapter,
              event,
              runCtx
            );
            yield* this.runChatStream(resumed, toolCtx, runCtx);
            return;
          }

          // Surface the pending call to the consumer flagged as
          // server-executed: it shows the approval dialog and resumes via
          // approveToolCall (no result) — the engine runs the tool.
          yield { ...event, serverExecuted: true };
          continue;
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
      fetch: this.pickFetch(profile),
    };

    return input.actionType === ActionType.Chat
      ? drainToFinal(chat(actionArgs))
      : runSync(input.actionType, actionArgs);
  }

  sendCustom(
    input: SendCustomInput
  ): AsyncGenerator<SendMessageResult> | Promise<ThreadMessageLike> {
    const pick = this.pickFetch.bind(this);
    return input.isStream
      ? runCustomStream(this.assignments, input, pick)
      : runCustomOnce(this.assignments, input, pick);
  }
}
