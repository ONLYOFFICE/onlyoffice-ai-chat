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
import { useI18n } from "../../locales";
import { useComponents } from "../../components-provider";
import { useStores } from "../../store/context";
import { useMessages } from "../../hooks";
import { AssistantMessage } from "./sub-components/AssistantMessage";
import { Composer } from "./sub-components/Composer";
import { UserMessage } from "./sub-components/UserMessage";
import { ThreadWelcome } from "./sub-components/Welcome";

import InitialSetup from "../initial-setup";

import "./Thread.css";

const ThreadInner = () => {
  const { Loader } = useComponents();
  const { useMessageStore } = useStores();
  const { isStreamRunning, isRequestRunning } = useMessageStore();
  const { t } = useI18n();
  return (
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

          {!isRequestRunning && isStreamRunning ? (
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
  );
};

const Thread = () => {
  const { useMessageStore, useProfilesStore } = useStores();
  const { messages, stopMessage } = useMessageStore();
  const { profiles } = useProfilesStore();
  const { onNew } = useMessages({ isReady: true });

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    onNew,
    onCancel: async () => {
      stopMessage();
    },
    convertMessage: (m: ThreadMessageLike) => m,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    },
  });

  if (!profiles.length) {
    return <InitialSetup />;
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadInner />
    </AssistantRuntimeProvider>
  );
};

export default Thread;
