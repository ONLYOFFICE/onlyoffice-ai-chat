import type { AppendMessage } from "@assistant-ui/react";
import { useCallback, useEffect, useRef } from "react";
import type { ChatEvent, ToolCallData } from "../services/chat-engine";
import { useStores } from "../store/context";

type UseMessagesProps = {
  isReady: boolean;
};

/**
 * Hook that manages the chat message lifecycle: sending new messages,
 * processing streaming events from the chat engine, and handling
 * tool-call approval/denial flows.
 *
 * @param props.isReady - Whether the widget is fully initialized and ready to send messages.
 * @returns An object with:
 *   - `onNew` — Callback to send a new user message (text + optional attachments).
 *   - `approveToolCall` — Approve a pending tool call (optionally with "allow always").
 *   - `denyToolCall` — Deny a pending tool call and continue the conversation.
 */
const useMessages = ({ isReady }: UseMessagesProps) => {
  const {
    useMessageStore,
    useThreadsStore,
    useServersStore,
    useAttachmentsStore,
    useProfilesStore,
    chatEngine,
    callbacksManager,
    middlewareRunner,
    selectCurrentChatProfile,
  } = useStores();

  const {
    messages,
    setIsStreamRunning,
    setIsRequestRunning,
    addMessage,
    updateLastMessage,
    fetchPrevMessages,
  } = useMessageStore();
  const { threadId, insertThread, insertNewMessageToThread } =
    useThreadsStore();
  const { manageToolData, setManageToolData } = useServersStore();
  const {
    attachmentFiles,
    clearAttachmentFiles,
    attachmentImages,
    clearAttachmentImages,
  } = useAttachmentsStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const extendedThinking = useProfilesStore((s) => s.extendedThinking);

  const threadIdRef = useRef(threadId);
  const extendedThinkingRef = useRef(extendedThinking);

  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    extendedThinkingRef.current = extendedThinking;
  }, [extendedThinking]);

  useEffect(() => {
    if (!isReady) return;

    fetchPrevMessages(threadId);
    clearAttachmentFiles();
  }, [threadId, isReady, fetchPrevMessages, clearAttachmentFiles]);

  const handleEvent = useCallback(
    async (event: ChatEvent) => {
      const tid = threadIdRef.current;

      // Run beforeDisplay middleware for message events
      if (
        event.type === "message-start" ||
        event.type === "message-delta" ||
        event.type === "message-end" ||
        event.type === "message-incomplete"
      ) {
        if (!middlewareRunner.isEmpty) {
          const isStreaming =
            event.type === "message-start" ||
            event.type === "message-delta";
          const result = await middlewareRunner.runBeforeDisplay({
            message: event.message,
            threadId: tid,
            isStreaming,
          });
          if (result.action === "skip") return;
          if (result.action === "continue" && result.message) {
            event = { ...event, message: result.message };
          }
        }
      }

      switch (event.type) {
        case "message-start":
          addMessage(event.message);
          callbacksManager.emit("onStreamStart", {
            threadId: tid,
            messageUID: event.messageUID,
          });
          break;
        case "message-delta":
          updateLastMessage(event.message);
          callbacksManager.emit("onStreamDelta", {
            threadId: tid,
            messageUID: event.messageUID,
            message: event.message,
          });
          break;
        case "message-end":
          setIsStreamRunning(false);
          setIsRequestRunning(false);
          callbacksManager.emit("onStreamEnd", {
            threadId: tid,
            messageUID: event.messageUID,
            message: event.message,
          });
          break;
        case "message-incomplete":
          addMessage(event.message);
          setIsStreamRunning(false);
          setIsRequestRunning(false);
          callbacksManager.emit("onStreamError", {
            threadId: tid,
            messageUID: "",
            error: {
              reason:
                event.message.status?.type === "incomplete"
                  ? (event.message.status.reason ?? "unknown")
                  : "unknown",
              message:
                event.message.status?.type === "incomplete"
                  ? String(event.message.status.error ?? "")
                  : undefined,
            },
          });
          break;
        case "tool-call-pending":
          setManageToolData({
            message: event.message,
            idx: event.idx,
            messageUID: event.messageUID,
          });
          break;
        case "thread-title":
          insertThread(event.title, { profileId: event.profileId });
          break;
      }
    },
    [
      addMessage,
      updateLastMessage,
      setIsStreamRunning,
      setIsRequestRunning,
      setManageToolData,
      insertThread,
      callbacksManager,
      middlewareRunner,
    ]
  );

  const handleEventRef = useRef(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  const processEvents = useCallback(
    async (events: AsyncGenerator<ChatEvent>) => {
      setIsStreamRunning(true);

      for await (const event of events) {
        if (event.type === "message-start") {
          setIsRequestRunning(true);
        }

        if (event.type === "tool-call-pending") {
          // Emit tool-call-pending callback
          const toolCall = event.message.content[event.idx];
          if (
            toolCall &&
            typeof toolCall === "object" &&
            "type" in toolCall &&
            toolCall.type === "tool-call"
          ) {
            callbacksManager.emit("onToolCallPending", {
              threadId: threadIdRef.current,
              toolName: toolCall.toolName,
              toolArgs: (toolCall.args ?? {}) as Record<string, unknown>,
              messageUID: event.messageUID,
            });
          }

          // Try auto-allow first via ChatEngine.handleToolCall
          const innerEvents = chatEngine.handleToolCall(
            event.message,
            event.idx,
            event.messageUID,
            extendedThinkingRef.current,
            threadIdRef.current
          );
          let handled = false;
          for await (const innerEvent of innerEvents) {
            if (innerEvent.type === "tool-call-pending") {
              // Not auto-allowed — show UI prompt
              setManageToolData({
                message: innerEvent.message,
                idx: innerEvent.idx,
                messageUID: innerEvent.messageUID,
              });
              handled = true;
            } else {
              // Auto-approved tool call
              if (
                innerEvent.type === "message-delta" &&
                toolCall &&
                typeof toolCall === "object" &&
                "type" in toolCall &&
                toolCall.type === "tool-call"
              ) {
                callbacksManager.emit("onToolCallAutoApproved", {
                  threadId: threadIdRef.current,
                  toolName: toolCall.toolName,
                  toolArgs: (toolCall.args ?? {}) as Record<string, unknown>,
                });
              }
              handleEventRef.current(innerEvent);
            }
          }
          if (handled) return;
        } else {
          handleEventRef.current(event);
        }
      }

      setIsStreamRunning(false);
      setIsRequestRunning(false);
    },
    [
      chatEngine,
      setIsStreamRunning,
      setIsRequestRunning,
      setManageToolData,
      callbacksManager,
    ]
  );

  const extractToolData = useCallback((): ToolCallData | null => {
    if (!manageToolData) return null;
    return {
      message: manageToolData.message,
      idx: manageToolData.idx,
      messageUID: manageToolData.messageUID,
    };
  }, [manageToolData]);

  const approveToolCall = useCallback(
    (allowAlways: boolean) => {
      const data = extractToolData();
      if (!data) return;

      // Emit approved callback
      const toolCall = data.message.content[data.idx];
      if (
        toolCall &&
        typeof toolCall === "object" &&
        "type" in toolCall &&
        toolCall.type === "tool-call"
      ) {
        callbacksManager.emit("onToolCallApproved", {
          threadId: threadIdRef.current,
          toolName: toolCall.toolName,
          toolArgs: (toolCall.args ?? {}) as Record<string, unknown>,
          allowAlways,
        });
      }

      setManageToolData(undefined);

      const events = chatEngine.approveToolCall(
        data,
        allowAlways,
        extendedThinkingRef.current
      );
      processEvents(events);
    },
    [
      extractToolData,
      chatEngine,
      setManageToolData,
      processEvents,
      callbacksManager,
    ]
  );

  const denyToolCall = useCallback(() => {
    const data = extractToolData();
    if (!data) return;

    // Emit denied callback
    const toolCall = data.message.content[data.idx];
    if (
      toolCall &&
      typeof toolCall === "object" &&
      "type" in toolCall &&
      toolCall.type === "tool-call"
    ) {
      callbacksManager.emit("onToolCallDenied", {
        threadId: threadIdRef.current,
        toolName: toolCall.toolName,
      });
    }

    setManageToolData(undefined);

    const events = chatEngine.denyToolCall(data, extendedThinkingRef.current);
    processEvents(events);
  }, [
    extractToolData,
    chatEngine,
    setManageToolData,
    processEvents,
    callbacksManager,
  ]);

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

    // Run beforeSend middleware
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

    const userMessage = {
      role: "user" as const,
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

    // Emit onMessageSent callback
    callbacksManager.emit("onMessageSent", {
      threadId,
      message: userMessage,
      attachments: { files, images },
    });

    if (
      !useThreadsStore.getState().threads.find((t) => t.threadId === threadId)
    ) {
      // New thread — will be created when title is generated
    } else {
      insertNewMessageToThread({ profileId: currentProfile?.id });
    }

    const events = chatEngine.sendMessage({
      text,
      threadId,
      files,
      images,
      existingMessages: messages,
      extendedThinking,
      profileId: currentProfile?.id,
    });

    processEvents(events);
  };

  return {
    onNew,
    approveToolCall,
    denyToolCall,
  };
};

export default useMessages;
