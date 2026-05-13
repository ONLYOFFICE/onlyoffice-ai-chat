import {
  ThreadPrimitive,
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { motion } from "framer-motion";
import { useCallback } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { useComponents } from "../../providers/ComponentsProvider";
import { useStores } from "../../store/context";
import { useMessages } from "../../hooks";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
import useEnsureThreads from "../../hooks/useEnsureThreads";
import useEnsurePrompts from "../../hooks/useEnsurePrompts";
import useEnsureTools from "../../hooks/useEnsureTools";
import { AssistantMessage } from "./sub-components/AssistantMessage";
import { Composer } from "./sub-components/Composer";
import { UserMessage } from "./sub-components/UserMessage";
import { ThreadWelcome } from "./sub-components/Welcome";
import { useChatDropAttachments } from "./useChatDropAttachments";

import InitialSetup from "../initial-setup";

import "./Thread.css";

const ThreadInner = () => {
  const { Loader } = useComponents();
  const { useMessageStore } = useStores();
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const isRequestRunning = useMessageStore((s) => s.isRequestRunning);
  const isToolPending = useMessageStore((s) => s.isToolPending);
  const messages = useMessageStore((s) => s.messages);
  const { t } = useI18n();
  const { isDragOver, handlers } = useChatDropAttachments();

  // Derive "tool is running" from the last assistant message — adapter
  // tools are executed inside the engine and never surface as
  // `tool-call-pending` to the UI, so `isToolPending` from the store
  // misses them. Reading the message itself catches both paths: a
  // tool-call part without a `result` means the tool hasn't returned.
  const hasUnresolvedToolCall = (() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return false;
    if (!Array.isArray(last.content)) return false;
    return last.content.some(
      (p) =>
        p &&
        typeof p === "object" &&
        (p as { type?: string }).type === "tool-call" &&
        (p as { result?: unknown }).result === undefined
    );
  })();

  const showAnalyzing =
    !isRequestRunning &&
    isStreamRunning &&
    !isToolPending &&
    !hasUnresolvedToolCall;

  return (
    <div
      className="aui-root relative flex h-full flex-col"
      onDragEnter={handlers.onDragEnter}
      onDragOver={handlers.onDragOver}
      onDragLeave={handlers.onDragLeave}
      onDrop={handlers.onDrop}
    >
      <ThreadPrimitive.Root
        className="flex h-full flex-col bg-[var(--layout-background-color)]"
        style={{
          ["--thread-max-width" as string]: "687px",
          ["--thread-padding-x" as string]: "1rem",
        }}
      >
        <ThreadPrimitive.If empty>
          <ThreadPrimitive.Viewport className="relative flex min-w-0 flex-1 flex-col overflow-y-auto justify-center items-center">
            <div className="flex flex-col gap-[24px] w-full">
              <ThreadWelcome />
              <Composer />
            </div>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.If>

        <ThreadPrimitive.If empty={false}>
          <ThreadPrimitive.Viewport className="relative flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto">
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage,
              }}
            />

            {showAnalyzing ? (
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-[8px] w-[var(--thread-max-width)] max-w-[var(--thread-max-width)] ps-[var(--thread-padding-x)]">
                  <Loader />
                  <p className="text-[14px] leading-[20px] font-normal text-[var(--chat-message-analyze-color)]">
                    {t("Analyzing")}
                  </p>
                </div>
              </div>
            ) : null}

            <motion.div className="min-h-6 min-w-6 shrink-0" />
          </ThreadPrimitive.Viewport>

          <Composer />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Root>
      {isDragOver ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--layout-background-color)]/80 backdrop-blur-sm">
          <div className="m-[16px] flex h-full w-full items-center justify-center rounded-[16px] border-2 border-dashed border-[var(--input-active-border-color)]">
            <p className="select-none text-[18px] font-bold leading-[24px] text-[var(--text-normal)]">
              {t("DropFilesHere")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Thread = () => {
  const { useMessageStore, useProfilesStore } = useStores();
  useEnsureProfiles();
  useEnsureThreads();
  useEnsurePrompts();
  useEnsureTools();
  const messages = useMessageStore((s) => s.messages);
  const stopMessage = useMessageStore((s) => s.stopMessage);
  const hasProfiles = useProfilesStore((s) => s.profiles.length > 0);
  const { onNew, regenerate } = useMessages({ isReady: true });

  const onCancel = useCallback(async () => {
    stopMessage();
  }, [stopMessage]);

  const onReload = useCallback(
    async (parentId: string | null) => {
      if (parentId === null) return;
      await regenerate(Number(parentId));
    },
    [regenerate]
  );

  const convertMessage = useCallback((m: ThreadMessageLike) => m, []);

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    onNew,
    onCancel,
    onReload,
    convertMessage,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    },
  });

  if (!hasProfiles) {
    return <InitialSetup />;
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadInner />
    </AssistantRuntimeProvider>
  );
};

export default Thread;
