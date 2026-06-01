import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import { useCallback, useEffect, useRef } from "react";
import {
  buildFileRefBlock,
  buildImageRefBlock,
} from "../../core/actions/attachment-resolution";
import type { ChatErrorPayload, ChatEvent } from "../../core/services";
import {
  patchToolCallArgs,
  patchToolCallResult,
  readToolCall,
} from "../../core/services/ai/tool-call";
import { useWidgetConfig } from "../../widget-config";
import { useStores } from "../store/context";
import { useToolsContext } from "../tools/context";

type UseMessagesProps = {
  isReady: boolean;
};

/**
 * Hook that drives the chat lifecycle on the client side.
 *
 * The core {@link AIEngine} stays middleware-free and emits a stream
 * of {@link ChatEvent}s; this hook applies the user-supplied
 * {@link MiddlewareRunner} and {@link CallbacksManager} around that
 * stream:
 *
 * - `beforeSend` runs before `api.ai.sendWithStream`.
 * - `onStreamChunk` runs on every `message-start` / `message-delta`.
 * - `beforeToolCall` runs on `tool-call-pending`. The middleware can
 *   pre-approve, deny, or rewrite arguments; otherwise the dialog
 *   surfaces and the user decides.
 * - `afterToolResult` runs on `tool-call-executed`. The middleware
 *   can rewrite or skip the result, then we call
 *   `api.ai.continueAfterToolCall`.
 * - `beforeDisplay` runs before every `addMessage` / `updateLastMessage`.
 * - `onError` runs on `message-incomplete`.
 *
 * Callbacks (`onStreamStart`, `onStreamDelta`, `onStreamEnd`,
 * `onStreamError`, `onMessageSent`, `onToolCallResult`) are emitted
 * from this hook in lockstep with the events.
 */
/**
 * Pull a user-facing string out of `status.error`. Engine-side errors
 * arrive as {@link ChatErrorPayload}, but the helper stays defensive
 * against stale wire payloads (raw strings, plain Error-likes) so the
 * `onStreamError` callback never surfaces `[object Object]`.
 */
function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const payload = error as Partial<ChatErrorPayload> & { message?: unknown };
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.code === "string") return payload.code;
  }
  return "";
}

const useMessages = ({ isReady }: UseMessagesProps) => {
  const {
    useMessageStore,
    useThreadsStore,
    useServersStore,
    useAttachmentsStore,
    useProfilesStore,
    api,
    callbacksManager,
    middlewareRunner,
    selectCurrentChatProfile,
  } = useStores();

  const messages = useMessageStore((s) => s.messages);
  const setIsStreamRunning = useMessageStore((s) => s.setIsStreamRunning);
  const setIsRequestRunning = useMessageStore((s) => s.setIsRequestRunning);
  const setIsToolPending = useMessageStore((s) => s.setIsToolPending);
  const setAbortController = useMessageStore((s) => s.setAbortController);
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateLastMessage = useMessageStore((s) => s.updateLastMessage);
  const truncateMessagesAfter = useMessageStore((s) => s.truncateMessagesAfter);
  const fetchPrevMessages = useMessageStore((s) => s.fetchPrevMessages);
  const claimThreadId = useMessageStore((s) => s.claimThreadId);
  const threadId = useThreadsStore((s) => s.threadId);
  const insertThread = useThreadsStore((s) => s.insertThread);
  const insertNewMessageToThread = useThreadsStore(
    (s) => s.insertNewMessageToThread
  );
  const setManageToolData = useServersStore((s) => s.setManageToolData);
  const tools = useServersStore((s) => s.tools);
  const attachmentFiles = useAttachmentsStore((s) => s.attachmentFiles);
  const clearAttachmentFiles = useAttachmentsStore(
    (s) => s.clearAttachmentFiles
  );
  const attachmentImages = useAttachmentsStore((s) => s.attachmentImages);
  const clearAttachmentImages = useAttachmentsStore(
    (s) => s.clearAttachmentImages
  );
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const extendedThinking = useProfilesStore((s) => s.extendedThinking);
  const { servers } = useToolsContext();
  const { entityId, systemPrompt } = useWidgetConfig();

  const threadIdRef = useRef(threadId);

  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    if (!isReady) return;
    // Skip the reload when the message store has already been claimed for
    // this threadId by the streaming path — see `claimThreadId`. Otherwise
    // a thread freshly created by the engine would briefly load its just-
    // streamed messages from storage and race with the in-memory list.
    const claimedId = useMessageStore.getState()._currentThreadId;
    if (claimedId === threadId && threadId) return;
    fetchPrevMessages(threadId);
    clearAttachmentFiles();
    clearAttachmentImages();
  }, [
    threadId,
    isReady,
    fetchPrevMessages,
    clearAttachmentFiles,
    clearAttachmentImages,
    useMessageStore,
  ]);

  const applyMiddlewareDisplay = useCallback(
    async (
      message: ThreadMessageLike,
      isStreaming: boolean
    ): Promise<ThreadMessageLike | null> => {
      if (middlewareRunner.isEmpty) return message;
      const result = await middlewareRunner.runBeforeDisplay({
        message,
        threadId: threadIdRef.current,
        isStreaming,
      });
      if (result.action === "skip") return null;
      if (result.action === "continue" && result.message) return result.message;
      return message;
    },
    [middlewareRunner]
  );

  const processStream = useCallback(
    async (
      stream: AsyncGenerator<ChatEvent>,
      initialThreadId: string,
      options?: { hasAssistantPlaceholder?: boolean }
    ) => {
      // `isStreamRunning` covers the whole round; `isRequestRunning` is true
      // only while a chunk is actively flowing. We start with the request
      // flag off so the "Analyzing" indicator surfaces immediately on submit
      // and stays visible until the first chunk lands. Each chunk flips it
      // back on and arms a 300ms idle timer — if no further chunk arrives
      // within that window the indicator reappears until the next chunk.
      // Note: during tool execution the chat UI gates "Analyzing" on
      // `isToolPending`, so we don't need any special handling here.
      setIsStreamRunning(true);
      setIsRequestRunning(false);

      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      const markChunk = () => {
        setIsRequestRunning(true);
        if (idleTimer !== null) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          idleTimer = null;
          setIsRequestRunning(false);
        }, 300);
      };
      // Hold the request flag without arming the idle timer — used while
      // a tool is executing so the "Analyzing" indicator stays hidden
      // until the model produces the next chunk.
      const holdBusy = () => {
        setIsRequestRunning(true);
        if (idleTimer !== null) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      };

      let assistantPlaceholderAdded = options?.hasAssistantPlaceholder ?? false;
      let lastDisplayedMessage: ThreadMessageLike | null = null;
      let resolvedThreadId = initialThreadId;
      const resolvedProfileId: string | undefined = currentProfile?.id;

      try {
        for await (const event of stream) {
          if (event.type === "thread-title") {
            if (event.threadId !== resolvedThreadId) {
              resolvedThreadId = event.threadId;
            }
            // Claim before insertThread sets `threadId`, so the useEffect
            // that reacts to threadId changes sees the claim and skips the
            // refetch — the in-memory messages already reflect this thread.
            claimThreadId(event.threadId);
            await insertThread(event.threadId, event.title, {
              profileId: event.profileId ?? resolvedProfileId,
            });
            continue;
          }

          if (event.type === "user-message-stored") {
            // Storage just persisted the user message — render it now,
            // with the storage-authoritative `id` and `createdAt`. We
            // skip the optimistic-placeholder pattern entirely so
            // assistant-ui's MessageRepository never sees a message
            // without an id (which would force it onto an index-based
            // fallback and produce phantom branches).
            addMessage(event.message);
            continue;
          }

          if (event.type === "tool-call-pending") {
            setIsToolPending(true);
            holdBusy();
            await handleToolCallPending(event);
            // Don't return — the engine may still yield `thread-title`
            // for new threads after the stream pauses on a tool call.
            // Bailing out here loses the auto-generated title.
            continue;
          }

          if (event.type === "message-incomplete") {
            markChunk();
            if (!middlewareRunner.isEmpty) {
              const status = event.message.status as
                | { reason?: string; error?: unknown; type?: string }
                | undefined;
              await middlewareRunner.runOnError({
                error: status?.error,
                type: "provider",
                threadId: resolvedThreadId,
                messageUID: "",
              });
            }
            const display = await applyMiddlewareDisplay(event.message, false);
            if (display) {
              if (!assistantPlaceholderAdded) {
                addMessage(display);
                assistantPlaceholderAdded = true;
              } else {
                updateLastMessage(display);
              }
              lastDisplayedMessage = display;
            }
            const status = event.message.status as
              | { reason?: string; error?: unknown }
              | undefined;
            callbacksManager.emit("onStreamError", {
              threadId: resolvedThreadId,
              messageUID: "",
              error: {
                reason: status?.reason ?? "unknown",
                message: extractErrorMessage(status?.error),
              },
            });
            continue;
          }

          // message-start | message-delta | message-end
          markChunk();
          const isTerminal = event.type === "message-end";

          let chunk = event.message;
          if (
            !middlewareRunner.isEmpty &&
            (event.type === "message-start" || event.type === "message-delta")
          ) {
            const result = await middlewareRunner.runOnStreamChunk({
              chunk,
              threadId: resolvedThreadId,
              messageUID: event.messageId,
              isFirst: event.type === "message-start",
            });
            if (result.action === "skip") continue;
            if (result.action === "continue" && result.chunk) {
              chunk = result.chunk;
            }
          }

          const display = await applyMiddlewareDisplay(chunk, !isTerminal);
          if (!display) continue;
          lastDisplayedMessage = display;

          if (!assistantPlaceholderAdded) {
            addMessage(display);
            assistantPlaceholderAdded = true;
            callbacksManager.emit("onStreamStart", {
              threadId: resolvedThreadId,
              messageUID: event.messageId,
            });
          } else {
            updateLastMessage(display);
            callbacksManager.emit("onStreamDelta", {
              threadId: resolvedThreadId,
              messageUID: event.messageId,
              message: display,
            });
          }

          if (isTerminal) {
            callbacksManager.emit("onStreamEnd", {
              threadId: resolvedThreadId,
              messageUID: event.messageId,
              message: display,
            });
          }
        }

        if (lastDisplayedMessage?.status?.type === "incomplete") {
          const status = lastDisplayedMessage.status as
            | { reason?: string; error?: unknown }
            | undefined;
          callbacksManager.emit("onStreamError", {
            threadId: resolvedThreadId,
            messageUID: "",
            error: {
              reason: status?.reason ?? "unknown",
              message: String(status?.error ?? ""),
            },
          });
        }
      } finally {
        if (idleTimer !== null) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        setIsStreamRunning(false);
        setIsRequestRunning(false);
        setAbortController(undefined);
      }

      // ---- nested helpers ----

      async function handleToolCallPending(
        event: Extract<ChatEvent, { type: "tool-call-pending" }>
      ) {
        const display = await applyMiddlewareDisplay(event.message, false);
        if (display) {
          if (!assistantPlaceholderAdded) {
            addMessage(display);
            assistantPlaceholderAdded = true;
          } else {
            updateLastMessage(display);
          }
        }

        const toolCall = readToolCall(event.message, event.idx);
        if (!toolCall) return;

        // System tools run on the server: the consumer only approves /
        // denies, never executes locally (no MCP connection in the browser).
        const isServerExecuted = Boolean(event.serverExecuted);

        let toolArgs = (toolCall.args ?? {}) as Record<string, unknown>;

        if (!middlewareRunner.isEmpty) {
          const mw = await middlewareRunner.runBeforeToolCall({
            toolName: toolCall.toolName,
            toolArgs,
            toolSource: servers.getServerType(toolCall.toolName),
            threadId: event.threadId,
            messageUID: event.messageId,
          });
          if (mw.action === "approve") {
            if (isServerExecuted)
              await approveServerExecuted(event, event.message);
            else await dispatchAndApprove(event, toolCall.toolName, toolArgs);
            return;
          }
          if (mw.action === "deny") {
            setIsToolPending(false);
            const next = api.ai.denyToolCall({
              threadId: event.threadId,
              messageId: event.messageId,
              idx: event.idx,
              message: event.message,
              entityId,
              actionArgs: {
                isReasoning: extendedThinking,
                tools: tools.length > 0 ? tools : undefined,
                prompt: systemPrompt,
              },
            });
            await processStream(next, resolvedThreadId);
            return;
          }
          if (mw.action === "continue" && mw.args) {
            toolArgs = mw.args;
          }
        }

        const dialogMessage =
          toolArgs !== toolCall.args
            ? patchToolCallArgs(
                event.message,
                event.idx,
                toolArgs as ReadonlyJSONObject
              )
            : event.message;

        if (event.autoAllow) {
          if (isServerExecuted)
            await approveServerExecuted(event, dialogMessage);
          else await dispatchAndApprove(event, toolCall.toolName, toolArgs);
          return;
        }

        // Surface the dialog to the user. Approve / deny will arrive
        // via `approveToolCall` / `denyToolCall` below.
        setManageToolData({
          threadId: event.threadId,
          message: dialogMessage,
          idx: event.idx,
          messageId: event.messageId,
          ...(isServerExecuted ? { serverExecuted: true } : {}),
        });
      }

      // Approve a server-executed (system) tool: no local dispatch — just
      // resume; the engine runs the tool in-process and streams the result.
      async function approveServerExecuted(
        event: Extract<ChatEvent, { type: "tool-call-pending" }>,
        message: ThreadMessageLike
      ) {
        setIsToolPending(false);
        const next = api.ai.approveToolCall({
          threadId: event.threadId,
          messageId: event.messageId,
          idx: event.idx,
          message,
          result: undefined,
          entityId,
          actionArgs: {
            isReasoning: extendedThinking,
            tools: tools.length > 0 ? tools : undefined,
            prompt: systemPrompt,
          },
        });
        await processStream(next, event.threadId, {
          hasAssistantPlaceholder: true,
        });
      }

      async function dispatchAndApprove(
        event: Extract<ChatEvent, { type: "tool-call-pending" }>,
        toolName: string,
        toolArgs: Record<string, unknown>
      ) {
        const serverType = servers.getServerType(toolName);
        const bareName = toolName.replace(`${serverType}_`, "");
        let result: unknown = await servers.callTools(
          serverType,
          bareName,
          toolArgs
        );

        if (!middlewareRunner.isEmpty) {
          const mw = await middlewareRunner.runAfterToolResult({
            toolName,
            toolArgs,
            result,
            threadId: event.threadId,
          });
          if (mw.action === "skip") {
            setIsStreamRunning(false);
            setIsRequestRunning(false);
            setIsToolPending(false);
            return;
          }
          if (mw.action === "continue" && mw.result !== undefined) {
            result = mw.result;
          }
        }

        callbacksManager.emit("onToolCallResult", {
          threadId: event.threadId,
          toolName,
          result,
        });

        // Patch the result onto the local assistant message so the UI
        // shows the tool-call as completed immediately. The engine
        // mirrors this write to storage inside `resumeChat`.
        const patched = patchToolCallResult(event.message, event.idx, result);
        updateLastMessage(patched);

        // Tool finished — give the UI a 300ms grace window before we
        // allow the "Analyzing" indicator to surface, so the indicator
        // doesn't flash between the tool spinner and the model's next
        // chunk.
        setTimeout(() => setIsToolPending(false), 300);

        const next = api.ai.approveToolCall({
          threadId: event.threadId,
          messageId: event.messageId,
          idx: event.idx,
          message: event.message,
          result,
          entityId,
          actionArgs: {
            isReasoning: extendedThinking,
            tools: tools.length > 0 ? tools : undefined,
            prompt: systemPrompt,
          },
        });
        await processStream(next, event.threadId, {
          hasAssistantPlaceholder: true,
        });
      }
    },
    [
      addMessage,
      updateLastMessage,
      applyMiddlewareDisplay,
      callbacksManager,
      claimThreadId,
      currentProfile,
      entityId,
      extendedThinking,
      insertThread,
      middlewareRunner,
      api,
      servers,
      setIsStreamRunning,
      setIsRequestRunning,
      setIsToolPending,
      setAbortController,
      setManageToolData,
      systemPrompt,
      tools,
    ]
  );

  const onNew = async (message: AppendMessage) => {
    if (!currentProfile) return;
    if (message.content[0].type !== "text") return;

    let text = message.content[0].text;
    const originalFiles = [...attachmentFiles];
    const originalImages = [...attachmentImages];
    let files = originalFiles.length > 0 ? [...originalFiles] : undefined;
    let images = originalImages.length > 0 ? [...originalImages] : undefined;

    if (!middlewareRunner.isEmpty) {
      const result = await middlewareRunner.runBeforeSend({
        text,
        files: files ?? [],
        images: images ?? [],
        threadId,
        profile: currentProfile,
        existingMessages: messages,
        resolveAttachment: async (id) => {
          const rec = await api.attachments.get(id);
          if (!rec) return null;
          return {
            title: rec.title,
            kind: rec.kind,
            content: rec.content,
            base64: rec.base64,
            path: rec.path,
            type: rec.type,
          };
        },
      });
      // Block path: leave the draft refs in place (both in zustand and
      // in storage) so the user can edit and retry. Deleting them here
      // would silently lose the upload.
      if (result.action === "block") return;
      if (result.action === "continue") {
        if (result.text !== undefined) text = result.text;
        if (result.files !== undefined)
          files = result.files.length > 0 ? result.files : undefined;
        if (result.images !== undefined)
          images = result.images.length > 0 ? result.images : undefined;
      }
    }

    // Middleware approved — clear the draft store without cascading
    // storage deletes (the refs going into the message will be linked
    // by `AIEngine.sendWithStream` right after persistence). Refs that
    // middleware FILTERED OUT need an explicit storage purge below,
    // since `linkAttachments` only touches what's actually in the
    // message.
    useAttachmentsStore.setState({
      attachmentFiles: [],
      attachmentImages: [],
    });

    const finalIds = new Set<string>();
    files?.forEach((f) => finalIds.add(f.id));
    images?.forEach((i) => finalIds.add(i.id));
    const excludedIds: string[] = [];
    for (const f of originalFiles) {
      if (!finalIds.has(f.id)) excludedIds.push(f.id);
    }
    for (const i of originalImages) {
      if (!finalIds.has(i.id)) excludedIds.push(i.id);
    }
    if (excludedIds.length > 0) {
      // Best-effort — orphaned excluded drafts get reclaimed by future
      // GC if this fails.
      api.attachments.deleteMany(excludedIds).catch(() => undefined);
    }

    const userMessage: ThreadMessageLike = {
      role: "user",
      content: [
        ...(files?.map((f) =>
          buildFileRefBlock({
            id: f.id,
            title: f.title,
            path: f.path,
            type: f.type,
          })
        ) ?? []),
        ...(images?.map((i) =>
          buildImageRefBlock({ id: i.id, title: i.title })
        ) ?? []),
        { type: "text" as const, text },
      ],
    };

    // Don't render an optimistic placeholder here — wait for the
    // engine's `user-message-stored` event so the runtime gets a
    // message with the storage-assigned `id` and `createdAt` from the
    // start. The IDB write that produces it is sub-millisecond.
    callbacksManager.emit("onMessageSent", {
      threadId,
      message: userMessage,
      attachments: { files, images },
    });

    const threadExists = useThreadsStore
      .getState()
      .threads.some((t) => t.threadId === threadId);
    const inputThreadId = threadExists ? threadId : undefined;
    if (threadExists) {
      await insertNewMessageToThread({ profileId: currentProfile.id });
    }

    const controller = new AbortController();
    setAbortController(controller);

    // Refresh the tool list from the store before sending — by this
    // point the `tools-changed` event handler may have run with newly-
    // arrived MCP tools, but our render-time `tools` snapshot is
    // stale. Reading via `getState()` avoids waiting for React's
    // commit and ships whatever the store currently has.
    await useServersStore.getState().getTools();
    const freshTools = useServersStore.getState().tools;
    console.info("[mcp] onNew sending message", {
      toolsCount: freshTools.length,
      toolsNames: freshTools.map((t) => t.name),
      toolsEnabled: freshTools
        .filter((t) => t.enabled !== false)
        .map((t) => t.name),
    });

    const stream = api.ai.sendWithStream({
      threadId: inputThreadId,
      userMessage,
      entityId,
      profileId: currentProfile.id,
      actionArgs: {
        isReasoning: extendedThinking,
        signal: controller.signal,
        tools: freshTools.length > 0 ? freshTools : undefined,
        prompt: systemPrompt,
      },
    });

    await processStream(stream, threadId);
  };

  const approveToolCall = useCallback(
    async (allowAlways: boolean) => {
      const data = useServersStore.getState().manageToolData;
      setManageToolData(undefined);
      if (!data) return;

      const toolCall = readToolCall(data.message, data.idx);
      if (!toolCall) return;

      // System tools: resume without local execution — the engine runs it.
      if (data.serverExecuted) {
        setIsToolPending(false);
        const stream = api.ai.approveToolCall({
          threadId: data.threadId,
          messageId: data.messageId,
          idx: data.idx,
          message: data.message,
          result: undefined,
          allowAlways,
          entityId,
          actionArgs: {
            isReasoning: extendedThinking,
            tools: tools.length > 0 ? tools : undefined,
            prompt: systemPrompt,
          },
        });
        await processStream(stream, data.threadId, {
          hasAssistantPlaceholder: true,
        });
        return;
      }

      const serverType = servers.getServerType(toolCall.toolName);
      const bareName = toolCall.toolName.replace(`${serverType}_`, "");
      const toolArgs = (toolCall.args ?? {}) as Record<string, unknown>;

      let result: unknown = await servers.callTools(
        serverType,
        bareName,
        toolArgs
      );

      if (!middlewareRunner.isEmpty) {
        const mw = await middlewareRunner.runAfterToolResult({
          toolName: toolCall.toolName,
          toolArgs,
          result,
          threadId: data.threadId,
        });
        if (mw.action === "skip") {
          setIsStreamRunning(false);
          setIsRequestRunning(false);
          return;
        }
        if (mw.action === "continue" && mw.result !== undefined) {
          result = mw.result;
        }
      }

      callbacksManager.emit("onToolCallResult", {
        threadId: data.threadId,
        toolName: toolCall.toolName,
        result,
      });

      const patched = patchToolCallResult(data.message, data.idx, result);
      updateLastMessage(patched);

      setTimeout(() => setIsToolPending(false), 300);

      const stream = api.ai.approveToolCall({
        threadId: data.threadId,
        messageId: data.messageId,
        idx: data.idx,
        message: data.message,
        result,
        allowAlways,
        entityId,
        profileId: currentProfile?.id,
        actionArgs: {
          isReasoning: extendedThinking,
          tools: tools.length > 0 ? tools : undefined,
          prompt: systemPrompt,
        },
      });
      await processStream(stream, data.threadId, {
        hasAssistantPlaceholder: true,
      });
    },
    [
      api,
      callbacksManager,
      entityId,
      extendedThinking,
      middlewareRunner,
      processStream,
      servers,
      setIsRequestRunning,
      setIsStreamRunning,
      setIsToolPending,
      setManageToolData,
      systemPrompt,
      tools,
      updateLastMessage,
      useServersStore,
    ]
  );

  const denyToolCall = useCallback(async () => {
    const data = useServersStore.getState().manageToolData;
    setManageToolData(undefined);
    if (!data) return;

    setIsToolPending(false);

    const stream = api.ai.denyToolCall({
      threadId: data.threadId,
      messageId: data.messageId,
      idx: data.idx,
      message: data.message,
      entityId,
      profileId: currentProfile?.id,
      actionArgs: {
        isReasoning: extendedThinking,
        tools: tools.length > 0 ? tools : undefined,
        prompt: systemPrompt,
      },
    });
    await processStream(stream, data.threadId);
  }, [
    api,
    currentProfile,
    entityId,
    extendedThinking,
    processStream,
    setIsToolPending,
    setManageToolData,
    systemPrompt,
    tools,
    useServersStore,
  ]);

  const regenerate = useCallback(
    async (parentIndex: number) => {
      if (!currentProfile) return;
      if (!threadId) return;

      const state = useMessageStore.getState();
      if (state.isStreamRunning) return;

      const msgs = state.messages;
      const parent = msgs[parentIndex];
      if (!parent || parent.role !== "user") return;

      truncateMessagesAfter(parentIndex);

      const controller = new AbortController();
      setAbortController(controller);

      await useServersStore.getState().getTools();
      const freshTools = useServersStore.getState().tools;

      const stream = api.ai.regenerateStream({
        threadId,
        entityId,
        profileId: currentProfile.id,
        actionArgs: {
          isReasoning: extendedThinking,
          signal: controller.signal,
          tools: freshTools.length > 0 ? freshTools : undefined,
          prompt: systemPrompt,
        },
      });

      await processStream(stream, threadId);
    },
    [
      api,
      currentProfile,
      entityId,
      extendedThinking,
      processStream,
      setAbortController,
      systemPrompt,
      threadId,
      tools,
      truncateMessagesAfter,
      useMessageStore,
      useServersStore,
    ]
  );

  return {
    onNew,
    regenerate,
    approveToolCall,
    denyToolCall,
  };
};

export default useMessages;
