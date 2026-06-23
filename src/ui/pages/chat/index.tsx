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
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { useComponents } from "../../providers/ComponentsProvider";
import { useStores } from "../../store/context";
import { useMessages } from "../../hooks";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
import useEnsureThreads from "../../hooks/useEnsureThreads";
import useEnsurePrompts from "../../hooks/useEnsurePrompts";
import useEnsureTools from "../../hooks/useEnsureTools";
import { ManageToolDialog } from "../../components/manage-tool-dialog";
import { AssistantMessage } from "./sub-components/AssistantMessage";
import { Composer } from "./sub-components/Composer";
import { Suggestions } from "./sub-components/Suggestions";
import { SuggestionsHeader } from "./sub-components/SuggestionsHeader";
import { UserMessage } from "./sub-components/UserMessage";
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

  const analyzingReady =
    !isRequestRunning &&
    isStreamRunning &&
    !isToolPending &&
    !hasUnresolvedToolCall;

  // Defer the "Analyzing" indicator by 400ms so it doesn't flash for
  // very fast responses. When the condition flips off, hide
  // immediately — only the show edge is debounced.
  const [showAnalyzing, setShowAnalyzing] = useState(false);
  useEffect(() => {
    if (!analyzingReady) {
      setShowAnalyzing(false);
      return;
    }
    const id = setTimeout(() => setShowAnalyzing(true), 400);
    return () => clearTimeout(id);
  }, [analyzingReady]);

  return (
    <div
      className="aui-root relative flex h-full flex-col select-none"
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
          <SuggestionsHeader />
          <ThreadPrimitive.Viewport className="relative flex min-w-0 flex-1 flex-col overflow-y-auto" />
          <Suggestions />
          <Composer />
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
                  <p className="font-normal text-[var(--chat-message-analyze-color)]">
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
            <p className="select-none text-fs-18 font-bold leading-[var(--lh-24)] text-[var(--text-normal)]">
              {t("DropFilesHere")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Thread = () => {
  const { useMessageStore, useProfilesStore, useRouter, useServersStore } =
    useStores();
  useEnsureProfiles();
  useEnsureThreads();
  useEnsurePrompts();
  useEnsureTools();
  const messages = useMessageStore((s) => s.messages);
  const stopMessage = useMessageStore((s) => s.stopMessage);
  const profilesInitialized = useProfilesStore((s) => s.initialized);
  const hasProfiles = useProfilesStore((s) => s.profiles.length > 0);
  const currentPage = useRouter((s) => s.currentPage);
  const setCurrentPage = useRouter((s) => s.setCurrentPage);
  const manageToolData = useServersStore((s) => s.manageToolData);
  const setManageToolData = useServersStore((s) => s.setManageToolData);
  const { onNew, regenerate, approveToolCall, denyToolCall } = useMessages({
    isReady: true,
  });

  // Keep `router.currentPage` in sync with what the Thread actually
  // renders. When profiles are missing, this component shows the
  // initial-setup screen; headless consumers expect `currentPage` to
  // reflect that. When the user finishes setup and profiles appear,
  // flip back to "chat" — but only if we owned the "initial-setup"
  // value, never override an explicit navigation to "settings" /
  // "history".
  useEffect(() => {
    if (!profilesInitialized) return;
    if (!hasProfiles && currentPage === "chat") {
      setCurrentPage("initial-setup");
    } else if (hasProfiles && currentPage === "initial-setup") {
      setCurrentPage("chat");
    }
  }, [profilesInitialized, hasProfiles, currentPage, setCurrentPage]);

  const onCancel = useCallback(async () => {
    stopMessage();
  }, [stopMessage]);

  const onReload = useCallback(
    async (parentId: string | null) => {
      if (parentId === null) return;
      await regenerate(parentId);
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

  if (!profilesInitialized) {
    return (
      <div className="aui-root h-full bg-[var(--layout-background-color)]" />
    );
  }

  if (!hasProfiles) {
    return <InitialSetup />;
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadInner />
      {/* Tool-approval dialog lives with the chat surface so every
          consumer of ChatPage (not just AIChatWidget) shows it — e.g.
          server-side system tools that pause for approval. */}
      {manageToolData ? (
        <ManageToolDialog
          onAllow={approveToolCall}
          onDeny={denyToolCall}
          onClose={() => setManageToolData(undefined)}
        />
      ) : null}
    </AssistantRuntimeProvider>
  );
};

export default Thread;
