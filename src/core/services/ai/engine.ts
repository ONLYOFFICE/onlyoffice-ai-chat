import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import {
  collectRefIds,
  extractRefIdsFromMessage,
  resolveAttachmentRefs,
} from "../../actions/attachment-resolution";
import {
  drainPages,
  isPaginationEnabled,
  messagesCursorOf,
} from "../../storage";
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
 *   system prompt. Runs against the caller's `profileId` when supplied,
 *   otherwise the `Default` profile. Mode (stream vs one-shot) chosen
 *   at call time via `isStream`.
 */
// Stamp the round's context scope into the user message before it is
// persisted: the message blob is the only per-thread storage that needs no
// backend schema change, so the conversation's context survives on the
// thread itself. The message store derives the thread's context back from
// the last user message when a thread is re-opened.
function stampThreadContext(
  message: ThreadMessageLike,
  contextEntityId: string | undefined
): ThreadMessageLike {
  if (!contextEntityId) return message;
  return {
    ...message,
    metadata: {
      ...message.metadata,
      custom: { ...message.metadata?.custom, contextEntityId },
    },
  };
}

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
      deps.threads ??
      new ThreadsEngine({
        storage: deps.storage,
        pagination: deps.pagination,
      });
    this.attachments = new AttachmentsEngine({ storage: deps.storage });
  }

  /**
   * Read a thread's complete history for the provider request. With
   * {@link AIEngineDeps.pagination} enabled the read walks the thread in
   * cursor pages (bounded requests, same complete result); otherwise it
   * is the single unbounded call — the pre-pagination behavior.
   */
  private readAllMessages(threadId: string): Promise<ThreadMessageLike[]> {
    if (!isPaginationEnabled(this.deps.pagination)) {
      return this.deps.storage.messages.readByThread(threadId);
    }
    return drainPages(
      (count, cursor) =>
        this.deps.storage.messages.readByThread(threadId, count, cursor),
      messagesCursorOf,
      (m) => m.id ?? ""
    );
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

  /** Resolve the `disableBuiltinImageTool` switch (lazy or static). */
  private isBuiltinImageToolDisabled(): boolean {
    const value = this.deps.disableBuiltinImageTool;
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
   *
   * When no override is given, `fallbackThreadId` lets a request that
   * continues an existing thread (tool approve/deny) recover the profile
   * the thread is already bound to — persisted by `sendWithStream` via
   * `appendUserMessage`. This keeps a resume on the thread's own model
   * even when the caller (any client of this engine, not just this UI)
   * didn't re-send `profileId`, instead of silently dropping to the global
   * default. Falls back to {@link AssignmentsEngine.resolveForAction} only
   * when neither the override nor the thread yields a live profile.
   */
  private async resolveChatProfile(
    overrideId: string | undefined,
    entityId: string | undefined,
    fallbackThreadId?: string
  ): Promise<ResolvedAssignment> {
    if (overrideId) {
      const profile = await this.deps.storage.profiles.readById(overrideId);
      if (profile) return { profileId: overrideId, profile };
    }
    if (fallbackThreadId) {
      const thread = await this.deps.storage.threads.readById(fallbackThreadId);
      if (thread?.profileId) {
        const profile = await this.deps.storage.profiles.readById(
          thread.profileId
        );
        if (profile) return { profileId: thread.profileId, profile };
      }
    }
    return this.assignments.resolveForAction(ActionType.Chat, entityId);
  }

  /**
   * Resolve the profile for a {@link sendCustom} call. When `overrideId`
   * is supplied and live, load it directly from storage — the caller's
   * profile pick wins over the `Default` slot for this request without
   * mutating any assignment, mirroring {@link resolveChatProfile}.
   * Falls back to the `Default` assignment when no override is given or
   * the id no longer resolves to a live profile.
   */
  private async resolveCustomProfile(
    overrideId: string | undefined
  ): Promise<ResolvedAssignment> {
    if (overrideId) {
      const profile = await this.deps.storage.profiles.readById(overrideId);
      if (profile) return { profileId: overrideId, profile };
    }
    return this.assignments.resolveForAction(ActionType.Default);
  }

  async *sendWithStream(input: SendStreamInput): AsyncGenerator<ChatEvent> {
    const contextScope = input.contextEntityId ?? input.entityId;
    const userMessage = stampThreadContext(
      input.userMessage,
      input.contextEntityId
    );
    const { profileId, profile } = await this.resolveChatProfile(
      input.profileId,
      contextScope
    );

    let threadId = input.threadId ?? "";
    let titlePromise: Promise<string> | null = null;
    let priorMessages: ThreadMessageLike[] = [];
    const isNewThread = !threadId;

    let storedUserMessage: ThreadMessageLike | null = null;

    if (!isNewThread) {
      priorMessages = stripUnresolvedToolCalls(
        await this.readAllMessages(threadId)
      ).filter(hasSendableContent);
      storedUserMessage = await this.threads.appendUserMessage(
        threadId,
        userMessage,
        profileId
      );
      const messageId = storedUserMessage.id!;
      await this.attachments.linkToMessage(
        extractRefIdsFromMessage(userMessage),
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
        userMessage
      );
      storedUserMessage = stored;
      if (stored.id) {
        await this.attachments.linkToMessage(
          extractRefIdsFromMessage(userMessage),
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

      // The real-title request is kicked off below, after attachment
      // refs are hydrated — it shares the resolved messages with the
      // chat request instead of paying a second attachments read.
    }

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      contextScope,
      {
        attachmentId: collectRefIds([...priorMessages, userMessage]),
      },
      this.getSystemServerTypes(),
      this.isBuiltinImageToolDisabled()
    );

    const proxiedFetch = this.pickFetch(profile);

    // Single hydration point for the round: image/file refs become inline
    // base64 here, and BOTH provider-bound requests below (title + chat)
    // consume the resolved list. Title generation is the only request
    // built from the bare user message, and it fires exactly once per
    // thread — on the first message — so without this it would ship the
    // ref JSON instead of the image.
    const resolvedMessages = await resolveAttachmentRefs(
      [...priorMessages, userMessage],
      this.deps.storage.attachments
    );

    if (isNewThread) {
      // priorMessages is empty on a new thread — the last (only) element
      // is the hydrated user message.
      titlePromise = generateTitle({
        profile,
        messages: [resolvedMessages[resolvedMessages.length - 1]],
        fetch: proxiedFetch,
      })
        .then((t) => t || "New chat")
        .catch(() => "New chat");
    }

    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: resolvedMessages,
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
      entityId: contextScope,
    });

    const chatEvents = this.runChatStream(stream, toolCtx, {
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      prompt: input.actionArgs?.prompt,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: contextScope,
      fetch: proxiedFetch,
      webSearchFetch: this.deps.fetchProxy,
      pickFetch: (p) => this.pickFetch(p),
      pagination: this.deps.pagination,
    });

    if (titlePromise) {
      yield* this.mergeTitleEvents(
        chatEvents,
        titlePromise,
        threadId,
        profileId
      );
    } else {
      yield* chatEvents;
    }
  }

  /**
   * Multiplex the async title generation into the chat event stream.
   *
   * The `thread-title` event is yielded the moment the title resolves —
   * interleaved between chunks while the reply is still streaming (the
   * common case, since the title request starts before the chat
   * request). Previously the generator awaited the title only AFTER the
   * stream, so a slow/hung title request kept the whole round (and the
   * UI busy state) open with nothing left to say.
   *
   * When the reply ends first, the round closes IMMEDIATELY and the
   * thread keeps its placeholder title ("New chat") for good — a late
   * title is deliberately discarded rather than applied out-of-band, so
   * nothing ever holds the round open just to rename a thread. The one
   * exception is a round paused on a tool call: it isn't over (the
   * consumer is in the approval dialog and the continuation runs as a
   * separate stream), so the generator stays open and the title still
   * lands as a trailing event.
   */
  private async *mergeTitleEvents(
    events: AsyncGenerator<ChatEvent>,
    titlePromise: Promise<string>,
    threadId: string,
    profileId: string
  ): AsyncGenerator<ChatEvent> {
    // Tagged so the race below can tell a resolved title apart from a
    // stream IteratorResult.
    let pendingTitle: Promise<{ __title: string }> | null = titlePromise.then(
      (title) => ({ __title: title })
    );
    let pendingEvent: Promise<IteratorResult<ChatEvent>> | null = null;

    const emitTitle = async (title: string): Promise<ChatEvent> => {
      await this.deps.storage.threads.update(threadId, title);
      return { type: "thread-title", threadId, title, profileId };
    };

    let pausedForToolCall = false;

    try {
      while (true) {
        pendingEvent ??= events.next();
        const winner = pendingTitle
          ? await Promise.race([pendingEvent, pendingTitle])
          : await pendingEvent;

        if ("__title" in winner) {
          pendingTitle = null;
          yield await emitTitle(winner.__title);
          // `pendingEvent` is still in flight — loop back and await it.
          continue;
        }

        pendingEvent = null;
        if (winner.done) break;
        pausedForToolCall = winner.value.type === "tool-call-pending";
        yield winner.value;
      }

      // Stream exhausted with the title still pending. A round paused on
      // a tool call isn't over — hold the generator so the title still
      // lands as a trailing event while the approval dialog is open.
      // Otherwise (reply terminal) fall through: the round closes now and
      // the placeholder title stays for good.
      if (pendingTitle && pausedForToolCall) {
        const { __title } = await pendingTitle;
        yield await emitTitle(__title);
      }
    } finally {
      // Forward early termination (consumer `return`/`throw`) to the
      // inner stream so the provider request is torn down — `yield*`
      // would have done this automatically; a manual pump must not leak.
      await events.return(undefined).catch(() => undefined);
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
    const contextScope = input.contextEntityId ?? input.entityId;
    const { profile } = await this.resolveChatProfile(
      input.profileId,
      contextScope
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
    const contextScope = input.contextEntityId ?? input.entityId;
    const { profileId, profile } = await this.resolveChatProfile(
      input.profileId,
      contextScope
    );

    const stored = await this.readAllMessages(input.threadId);

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
      contextScope,
      { attachmentId: collectRefIds(priorMessages) },
      this.getSystemServerTypes(),
      this.isBuiltinImageToolDisabled()
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
      entityId: contextScope,
    });

    yield* this.runChatStream(stream, toolCtx, {
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      prompt: input.actionArgs?.prompt,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: contextScope,
      fetch: proxiedFetch,
      webSearchFetch: this.deps.fetchProxy,
      pickFetch: (p) => this.pickFetch(p),
      pagination: this.deps.pagination,
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
    const contextScope = input.contextEntityId ?? input.entityId;
    if (input.allowAlways) {
      const toolCall = readToolCall(input.message, input.idx);
      if (toolCall) {
        const current =
          await this.deps.storage.toolPrefs.readAllowAlways(contextScope);
        if (!current.includes(toolCall.toolName)) {
          await this.deps.storage.toolPrefs.upsertAllowAlways(
            [...current, toolCall.toolName],
            contextScope
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
          contextScope,
          input.threadId
        );
        const toolCtx = await buildToolContext(
          this.deps.storage,
          this.deps.toolsAdapter,
          input.actionArgs?.tools ?? [],
          contextScope,
          undefined,
          systemServerTypes,
          this.isBuiltinImageToolDisabled()
        );
        if (toolCtx.systemToolNames.has(toolCall.toolName)) {
          const proxiedFetch = this.pickFetch(profile);
          const runCtx: AdapterRunContext = {
            profile,
            profileId,
            tools: toolCtx.mergedTools,
            prompt: input.actionArgs?.prompt,
            isReasoning: input.actionArgs?.isReasoning,
            signal: input.actionArgs?.signal,
            entityId: contextScope,
            fetch: proxiedFetch,
            webSearchFetch: this.deps.fetchProxy,
            pickFetch: (p) => this.pickFetch(p),
            pagination: this.deps.pagination,
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
    const contextScope = input.contextEntityId ?? input.entityId;
    const { profile, profileId } = await this.resolveChatProfile(
      input.profileId,
      contextScope,
      input.threadId
    );

    const toolCtx = await buildToolContext(
      this.deps.storage,
      this.deps.toolsAdapter,
      input.actionArgs?.tools ?? [],
      contextScope,
      undefined,
      this.getSystemServerTypes(),
      this.isBuiltinImageToolDisabled()
    );
    const proxiedFetch = this.pickFetch(profile);
    const runCtx: AdapterRunContext = {
      profile,
      profileId,
      tools: toolCtx.mergedTools,
      prompt: input.actionArgs?.prompt,
      isReasoning: input.actionArgs?.isReasoning,
      signal: input.actionArgs?.signal,
      entityId: contextScope,
      fetch: proxiedFetch,
      webSearchFetch: this.deps.fetchProxy,
      pickFetch: (p) => this.pickFetch(p),
      pagination: this.deps.pagination,
    };

    const resumed = resumeChat(
      { storage: this.deps.storage, pagination: this.deps.pagination },
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
        prompt: input.actionArgs?.prompt,
        entityId: contextScope,
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
   * round-trip. Tools sourced from `actionArgs.tools` are forwarded
   * untouched so the UI can run its `beforeToolCall` middleware.
   *
   * A call to a tool that is in neither list — a name the model invented,
   * or one switched off mid-thread (Web search toggled off, an MCP server
   * removed) — is resolved in-engine with a "not available" error result
   * and the chat resumes, instead of surfacing a phantom approval dialog
   * (which would throw and hang the turn if approved). This is the single
   * chokepoint every send / regenerate / resume round funnels through.
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

        if (source === "unknown" && toolCall) {
          // The model asked for a tool that isn't offered this turn.
          // Resolve it with a "not available" result and resume so the
          // model recovers on the same turn — never surface it for
          // approval (dispatching a phantom tool throws and hangs).
          const resumed = resumeChat(
            { storage: this.deps.storage, pagination: runCtx.pagination },
            {
              threadId: event.threadId,
              messageId: event.messageId,
              idx: event.idx,
              message: event.message,
              result: JSON.stringify({
                error: `Tool "${toolCall.toolName}" is not available.`,
              }),
              profile: runCtx.profile,
              profileId: runCtx.profileId,
              isReasoning: runCtx.isReasoning,
              signal: runCtx.signal,
              tools: runCtx.tools,
              prompt: runCtx.prompt,
              entityId: runCtx.entityId,
              fetch: runCtx.fetch,
            }
          );
          yield* this.runChatStream(resumed, toolCtx, runCtx);
          return;
        }
      }
      yield event;
    }
  }

  async send(input: SendInput): Promise<ThreadMessageLike> {
    const contextScope = input.contextEntityId ?? input.entityId;
    const { profile } = await this.assignments.resolveForAction(
      input.actionType,
      contextScope
    );
    // Hydrate image/file refs into inline data before the provider sees
    // them — mirrors the streaming paths. Without this a Vision/OCR/etc.
    // action would ship the raw ref (or a host URL) instead of base64.
    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: await resolveAttachmentRefs(
        [input.userMessage],
        this.deps.storage.attachments
      ),
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
    const attachments = this.deps.storage.attachments;
    const resolveProfile = () => this.resolveCustomProfile(input.profileId);
    return input.isStream
      ? runCustomStream(resolveProfile, input, pick, attachments)
      : runCustomOnce(resolveProfile, input, pick, attachments);
  }
}
