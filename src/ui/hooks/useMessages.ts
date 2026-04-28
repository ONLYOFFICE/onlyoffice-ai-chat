import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import { useCallback, useEffect, useRef } from "react";
import type { ChatEvent } from "../../core/services";
import { useStores } from "../store/context";

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

  const {
    messages,
    setIsStreamRunning,
    setIsRequestRunning,
    setAbortController,
    addMessage,
    updateLastMessage,
    fetchPrevMessages,
    claimThreadId,
  } = useMessageStore();
  const { threadId, insertThread, insertNewMessageToThread } =
    useThreadsStore();
  const { setManageToolData, tools } = useServersStore();
  const {
    attachmentFiles,
    clearAttachmentFiles,
    attachmentImages,
    clearAttachmentImages,
  } = useAttachmentsStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const extendedThinking = useProfilesStore((s) => s.extendedThinking);

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
  }, [
    threadId,
    isReady,
    fetchPrevMessages,
    clearAttachmentFiles,
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
      setIsStreamRunning(true);
      setIsRequestRunning(true);

      let assistantPlaceholderAdded =
        options?.hasAssistantPlaceholder ?? false;
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

          if (event.type === "tool-call-pending") {
            await handleToolCallPending(event);
            return;
          }

          if (event.type === "tool-call-executed") {
            await handleToolCallExecuted(event);
            return;
          }

          if (event.type === "message-incomplete") {
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
                message: String(status?.error ?? ""),
              },
            });
            continue;
          }

          // message-start | message-delta | message-end
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

        const toolCall = readToolCallPart(event.message, event.idx);
        if (!toolCall) return;

        let modifiedArgs: Record<string, unknown> | undefined;

        if (!middlewareRunner.isEmpty) {
          const mw = await middlewareRunner.runBeforeToolCall({
            toolName: toolCall.toolName,
            toolArgs: (toolCall.args ?? {}) as Record<string, unknown>,
            toolSource: getServerType(toolCall.toolName),
            threadId: event.threadId,
            messageUID: event.messageId,
          });
          if (mw.action === "approve") {
            const next = api.ai.approveToolCall({
              threadId: event.threadId,
              messageId: event.messageId,
              idx: event.idx,
              message: event.message,
              allowAlways: false,
              isReasoning: extendedThinking,
              tools: tools.length > 0 ? tools : undefined,
            });
            await processStream(next, resolvedThreadId);
            return;
          }
          if (mw.action === "deny") {
            const next = api.ai.denyToolCall({
              threadId: event.threadId,
              messageId: event.messageId,
              idx: event.idx,
              message: event.message,
              isReasoning: extendedThinking,
              tools: tools.length > 0 ? tools : undefined,
            });
            await processStream(next, resolvedThreadId);
            return;
          }
          if (mw.action === "continue" && mw.args) {
            modifiedArgs = mw.args;
          }
        }

        // Surface the dialog to the user. Approve / deny will arrive
        // via `approveToolCall` / `denyToolCall` below.
        setManageToolData({
          threadId: event.threadId,
          message: event.message,
          idx: event.idx,
          messageId: event.messageId,
        });
        // Stash the modified args alongside the dialog payload by
        // reusing `manageToolData.message` — patch the args in-place so
        // when the user approves, the engine sees them.
        if (modifiedArgs) {
          const patchedMessage = patchToolCallArgs(
            event.message,
            event.idx,
            modifiedArgs
          );
          setManageToolData({
            threadId: event.threadId,
            message: patchedMessage,
            idx: event.idx,
            messageId: event.messageId,
          });
        }
      }

      async function handleToolCallExecuted(
        event: Extract<ChatEvent, { type: "tool-call-executed" }>
      ) {
        let result = event.result;

        if (!middlewareRunner.isEmpty) {
          const toolCall = readToolCallPart(event.message, event.idx);
          const mw = await middlewareRunner.runAfterToolResult({
            toolName: event.toolName,
            toolArgs: (toolCall?.args ?? {}) as Record<string, unknown>,
            result,
            threadId: event.threadId,
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
          threadId: event.threadId,
          toolName: event.toolName,
          result,
        });

        // Patch the result onto the local assistant message so the UI
        // shows the tool-call as completed immediately. The engine
        // mirrors this write to storage in `resumeChat`, but the local
        // store is the source of truth for the live runtime.
        const patched = patchToolCallResult(event.message, event.idx, result);
        updateLastMessage(patched);

        const next = api.ai.continueAfterToolCall({
          threadId: event.threadId,
          messageId: event.messageId,
          idx: event.idx,
          message: event.message,
          result,
          isReasoning: extendedThinking,
          tools: tools.length > 0 ? tools : undefined,
        });
        // The post-tool-call round extends the SAME assistant bubble:
        // tell the recursive stream loop the placeholder is already in
        // the list so the first delta updates it instead of appending.
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
      extendedThinking,
      insertThread,
      middlewareRunner,
      api,
      setIsStreamRunning,
      setIsRequestRunning,
      setAbortController,
      setManageToolData,
      tools,
    ]
  );

  const onNew = async (message: AppendMessage) => {
    if (!currentProfile) return;
    if (message.content[0].type !== "text") return;

    let text = message.content[0].text;
    let files =
      attachmentFiles.length > 0 ? [...attachmentFiles] : undefined;
    let images =
      attachmentImages.length > 0 ? [...attachmentImages] : undefined;

    if (files) clearAttachmentFiles();
    if (images) clearAttachmentImages();

    if (!middlewareRunner.isEmpty) {
      const result = await middlewareRunner.runBeforeSend({
        text,
        files: files ?? [],
        images: images ?? [],
        threadId,
        profile: currentProfile,
        existingMessages: messages,
      });
      if (result.action === "block") return;
      if (result.action === "continue") {
        if (result.text !== undefined) text = result.text;
        if (result.files !== undefined)
          files = result.files.length > 0 ? result.files : undefined;
        if (result.images !== undefined)
          images = result.images.length > 0 ? result.images : undefined;
      }
    }

    const userMessage: ThreadMessageLike = {
      role: "user",
      content: [
        ...(files?.map((f) => ({
          type: "file" as const,
          mimeType: JSON.stringify({ path: f.path, type: f.type }),
          data: f.content,
        })) ?? []),
        ...(images?.map((i) => ({
          type: "image" as const,
          image: i.base64,
          name: i.name,
        })) ?? []),
        { type: "text" as const, text },
      ],
    };

    addMessage(userMessage);

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

    const stream = api.ai.sendWithStream({
      threadId: inputThreadId,
      userMessage,
      actionArgs: {
        isReasoning: extendedThinking,
        signal: controller.signal,
        tools: tools.length > 0 ? tools : undefined,
      },
    });

    await processStream(stream, threadId);
  };

  const approveToolCall = useCallback(
    async (allowAlways: boolean) => {
      const data = useServersStore.getState().manageToolData;
      setManageToolData(undefined);
      if (!data) return;

      const stream = api.ai.approveToolCall({
        threadId: data.threadId,
        messageId: data.messageId,
        idx: data.idx,
        message: data.message,
        allowAlways,
        isReasoning: extendedThinking,
        tools: tools.length > 0 ? tools : undefined,
      });
      await processStream(stream, data.threadId);
    },
    [
      api,
      extendedThinking,
      processStream,
      setManageToolData,
      tools,
      useServersStore,
    ]
  );

  const denyToolCall = useCallback(async () => {
    const data = useServersStore.getState().manageToolData;
    setManageToolData(undefined);
    if (!data) return;

    const stream = api.ai.denyToolCall({
      threadId: data.threadId,
      messageId: data.messageId,
      idx: data.idx,
      message: data.message,
      isReasoning: extendedThinking,
      tools: tools.length > 0 ? tools : undefined,
    });
    await processStream(stream, data.threadId);
  }, [
    api,
    extendedThinking,
    processStream,
    setManageToolData,
    tools,
    useServersStore,
  ]);

  return {
    onNew,
    approveToolCall,
    denyToolCall,
  };
};

// ---- helpers ----

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

function patchToolCallArgs(
  message: ThreadMessageLike,
  idx: number,
  args: Record<string, unknown>
): ThreadMessageLike {
  if (!Array.isArray(message.content)) return message;
  const next = message.content.map((item, i) => {
    if (i !== idx) return item;
    if (
      !item ||
      typeof item !== "object" ||
      (item as { type?: string }).type !== "tool-call"
    ) {
      return item;
    }
    return { ...(item as object), args };
  });
  return { ...message, content: next } as ThreadMessageLike;
}

function patchToolCallResult(
  message: ThreadMessageLike,
  idx: number,
  result: unknown
): ThreadMessageLike {
  if (!Array.isArray(message.content)) return message;
  const next = message.content.map((item, i) => {
    if (i !== idx) return item;
    if (
      !item ||
      typeof item !== "object" ||
      (item as { type?: string }).type !== "tool-call"
    ) {
      return item;
    }
    return { ...(item as object), result };
  });
  return { ...message, content: next } as ThreadMessageLike;
}

function getServerType(toolName: string): string {
  // Best-effort heuristic — the dispatcher knows the canonical answer
  // but isn't reachable from this hook. For middleware purposes we
  // surface the prefix before the underscore (e.g. "web-search_search"
  // → "web-search"), or empty when the tool name has no prefix.
  const idx = toolName.indexOf("_");
  return idx === -1 ? "" : toolName.slice(0, idx);
}

export default useMessages;
