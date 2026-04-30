import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import { useCallback, useEffect, useRef } from "react";
import type { ChatEvent } from "../../core/services";
import {
  patchToolCallArgs,
  patchToolCallResult,
  readToolCall,
} from "../../core/services/ai/tool-call";
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
  const { servers } = useToolsContext();

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
      // `isStreamRunning` covers the whole round; `isRequestRunning` is true
      // only while a chunk is actively flowing. We start with the request
      // flag off so the "Analyzing" indicator surfaces immediately on submit
      // and stays visible until the first chunk lands. Each chunk flips it
      // back on and arms a 300ms idle timer — if no further chunk arrives
      // within that window the indicator reappears until the next chunk.
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
            markChunk();
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
                message: String(status?.error ?? ""),
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
            await dispatchAndApprove(event, toolCall.toolName, toolArgs);
            return;
          }
          if (mw.action === "deny") {
            const next = api.ai.denyToolCall({
              threadId: event.threadId,
              messageId: event.messageId,
              idx: event.idx,
              message: event.message,
              actionArgs: {
                isReasoning: extendedThinking,
                tools: tools.length > 0 ? tools : undefined,
              },
            });
            await processStream(next, resolvedThreadId);
            return;
          }
          if (mw.action === "continue" && mw.args) {
            toolArgs = mw.args;
          }
        }

        if (event.autoAllow) {
          await dispatchAndApprove(event, toolCall.toolName, toolArgs);
          return;
        }

        // Surface the dialog to the user. Approve / deny will arrive
        // via `approveToolCall` / `denyToolCall` below.
        const dialogMessage =
          toolArgs !== toolCall.args
            ? patchToolCallArgs(
                event.message,
                event.idx,
                toolArgs as ReadonlyJSONObject
              )
            : event.message;
        setManageToolData({
          threadId: event.threadId,
          message: dialogMessage,
          idx: event.idx,
          messageId: event.messageId,
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

        const next = api.ai.approveToolCall({
          threadId: event.threadId,
          messageId: event.messageId,
          idx: event.idx,
          message: event.message,
          result,
          actionArgs: {
            isReasoning: extendedThinking,
            tools: tools.length > 0 ? tools : undefined,
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
      extendedThinking,
      insertThread,
      middlewareRunner,
      api,
      servers,
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

      const toolCall = readToolCall(data.message, data.idx);
      if (!toolCall) return;

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

      const stream = api.ai.approveToolCall({
        threadId: data.threadId,
        messageId: data.messageId,
        idx: data.idx,
        message: data.message,
        result,
        allowAlways,
        actionArgs: {
          isReasoning: extendedThinking,
          tools: tools.length > 0 ? tools : undefined,
        },
      });
      await processStream(stream, data.threadId, {
        hasAssistantPlaceholder: true,
      });
    },
    [
      api,
      callbacksManager,
      extendedThinking,
      middlewareRunner,
      processStream,
      servers,
      setIsRequestRunning,
      setIsStreamRunning,
      setManageToolData,
      tools,
      updateLastMessage,
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
      actionArgs: {
        isReasoning: extendedThinking,
        tools: tools.length > 0 ? tools : undefined,
      },
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

export default useMessages;
