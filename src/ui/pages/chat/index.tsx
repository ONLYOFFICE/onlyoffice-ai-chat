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
import { useWidgetConfig } from "../../../widget-config";
import { useStores } from "../../store/context";
import { useMessages } from "../../hooks";
import useEnsureProfiles from "../../hooks/useEnsureProfiles";
import useEnsureThreads from "../../hooks/useEnsureThreads";
import useEnsurePrompts from "../../hooks/useEnsurePrompts";
import useEnsureTools from "../../hooks/useEnsureTools";
import { ManageToolDialog } from "../../components/manage-tool-dialog";
import { Icon } from "../../components/icon";
import { AssistantMessage } from "./sub-components/AssistantMessage";
import { Composer } from "./sub-components/Composer";
import { ComposerHeader } from "./sub-components/ComposerHeader";
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
  const { hideScrollToBottomButton, hideThreadFade } = useWidgetConfig();

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
          ["--thread-max-width" as string]:
            "var(--chat-thread-max-width, 687px)",
          ["--thread-padding-x" as string]:
            "var(--chat-thread-padding-x, 1rem)",
        }}
      >
        <ThreadPrimitive.If empty>
          <SuggestionsHeader />
          <ThreadPrimitive.Viewport className="relative flex min-w-0 flex-1 flex-col overflow-y-auto" />
          <Suggestions />
          <ComposerHeader />
          <Composer />
        </ThreadPrimitive.If>

        <ThreadPrimitive.If empty={false}>
          {/* Non-scrolling wrapper so the fade overlays stay pinned to the
              top and bottom edges of the message area instead of scrolling
              away with the content inside the viewport. */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <ThreadPrimitive.Viewport className="relative flex min-w-0 flex-1 flex-col gap-[10px] overflow-y-auto">
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

              <motion.div className="min-h-[8px] min-w-6 shrink-0" />
            </ThreadPrimitive.Viewport>

            {/* Floating "scroll to bottom" button (shown by default; hide
                  via `hideScrollToBottomButton`). Sticks to the bottom of the
                  scroll viewport and is auto-disabled by the primitive when
                  the thread is already scrolled to the end — we fade it out
                  via `disabled:` so it only appears while scrolled up. */}
            {!hideScrollToBottomButton ? (
              <div className="scroll-to-bottom pointer-events-none absolute inset-x-0 z-10 mx-auto flex w-full max-w-[var(--thread-max-width)] justify-end">
                <ThreadPrimitive.ScrollToBottom asChild>
                  <button
                    type="button"
                    className="scroll-to-bottom-btn pointer-events-auto m-0 box-border flex items-center justify-center border p-0 leading-none transition-opacity duration-150 disabled:pointer-events-none disabled:opacity-0"
                  >
                    <Icon
                      name="dropdown-toggle"
                      color="var(--icon-normal)"
                      width={16}
                      height={24}
                      isStroke
                    />
                  </button>
                </ThreadPrimitive.ScrollToBottom>
              </div>
            ) : null}

            {/* Top/bottom fade of the thread content into the panel
                background. */}
            {!hideThreadFade ? (
              <>
                <div
                  aria-hidden="true"
                  className="thread-fade thread-fade-top pointer-events-none"
                />
                <div
                  aria-hidden="true"
                  className="thread-fade thread-fade-bottom pointer-events-none"
                />
              </>
            ) : null}
          </div>

          <ComposerHeader />
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
  // `isStreamRunning` spans the whole round (request → stream → tool calls);
  // feeding it to the runtime as `isRunning` lets assistant-ui emit
  // `thread.run-start`, which drives its built-in scroll-to-bottom on send.
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
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
    isRunning: isStreamRunning,
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
