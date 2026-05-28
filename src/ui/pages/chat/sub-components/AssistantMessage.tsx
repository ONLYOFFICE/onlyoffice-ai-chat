import {
  ActionBarPrimitive,
  MessagePrimitive,
  useMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { ChatErrorPayload } from "../../../../core/services";
import { motion } from "framer-motion";
import {
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { usePlatform } from "../../../providers/PlatformProvider/context";
import { useComponents } from "../../../providers/ComponentsProvider";
import { Icon } from "../../../components/icon";
import { MarkdownContent } from "../../../components/markdown";
import { ToolFallback } from "../../../components/tool-fallback";
import {
  convertMessagesToMd,
  getMessageTitleFromMd,
} from "../../../../shared/utils";
import { getMessageText } from "../../../../utils";
import logger from "../../../../shared/logger";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import type { AssistantAction } from "../assistant-actions";

const ThinkingMarkdownText = memo(
  ({
    text,
    type,
    parentId,
  }: {
    text: string;
    type: string;
    parentId?: string;
  }) => {
    const { Loader } = useComponents();
    const { t } = useI18n();
    const [isCollapsed, setIsCollapsed] = useState(true);

    return (
      <>
        {type === "reasoning" ? (
          <div className="my-[8px] flex w-full flex-col">
            <div
              className="flex items-center gap-[10px] cursor-pointer mb-[8px]"
              onClick={() => setIsCollapsed((val) => !val)}
            >
              {parentId ? (
                <Icon name="tool.called" size={16} noColor />
              ) : (
                <Loader size={16} />
              )}
              <div className="flex items-center bg-[var(--background-normal-element)] rounded-[4px] gap-[8px] ps-[4px] pe-[8px]">
                <Icon name="btn-extended-thinking" size={24} />
                <span className="text-[14px] font-normal leading-[20px] text-[var(--chat-message-color)] ">
                  {t("Thinking")}
                </span>
              </div>

              <Icon
                name="arrow.right"
                size={16}
                width={8}
                height={8}
                isStroke
                className={!isCollapsed ? "rotate-90" : ""}
              />
            </div>
            {!isCollapsed && (
              <div className="ps-[12px] ms-[13px] border-l-[var(--border-divider)] border-l-[1px]">
                <MarkdownContent>{text}</MarkdownContent>
              </div>
            )}
          </div>
        ) : (
          <MarkdownContent>{text}</MarkdownContent>
        )}
      </>
    );
  }
);

const LOCALIZED_ERROR_CODES = new Set([
  "auth",
  "model_not_found",
  "rate_limit",
  "timeout",
  "network",
  "aborted",
]);

const MessageError = () => {
  const { t } = useI18n();
  const message = useMessage();
  const status = message.status as
    | { type?: string; reason?: string; error?: ChatErrorPayload | unknown }
    | undefined;

  if (status?.type !== "incomplete" || status?.reason !== "error") return null;

  const payload = status.error as ChatErrorPayload | undefined;
  // Defensive: tolerate older payloads (string / Error) that pre-date
  // engine-side normalization. Shouldn't happen in-process from this
  // version onward, but keep the UI useful if a stale host proxies an
  // un-normalized event.
  const code =
    payload && typeof payload === "object" && typeof payload.code === "string"
      ? payload.code
      : "unknown";
  const fallback =
    payload &&
    typeof payload === "object" &&
    typeof payload.message === "string"
      ? payload.message
      : typeof payload === "string"
        ? payload
        : t("Error");
  const text = LOCALIZED_ERROR_CODES.has(code)
    ? t(`ChatError.${code}`)
    : fallback;

  return (
    <div
      role="alert"
      className="border border-[var(--chat-message-error-border-color)] rounded-[4px] p-[6px]"
    >
      <div className="text-[var(--chat-message-error-color)] text-[14px] leading-[20px] font-normal">
        {text}
      </div>
      <div className="text-[var(--chat-message-error-color)] text-[11px] leading-[16px] font-normal opacity-60 mt-[2px]">
        {code}
      </div>
    </div>
  );
};

const CustomActionButton = ({
  action,
  message,
}: {
  action: AssistantAction;
  message: ThreadMessageLike;
}) => {
  const { IconButton, TooltipIconButton } = useComponents();

  const text = getMessageText(message);
  const markdown = convertMessagesToMd([message]);
  const ctx = { text, message, markdown };

  if (action.isVisible && !action.isVisible(ctx)) return null;

  const onClick = () => {
    try {
      const result = action.onClick(ctx);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).catch((err) => {
          logger.error(`AssistantAction "${action.id}" failed:`, err);
        });
      }
    } catch (err) {
      logger.error(`AssistantAction "${action.id}" failed:`, err);
    }
  };

  return (
    <div>
      <TooltipIconButton tooltip={action.tooltip}>
        {typeof action.icon === "string" ? (
          <IconButton
            iconName={action.icon}
            size={24}
            onClick={onClick}
            isStroke
          />
        ) : isValidElement(action.icon) ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={action.tooltip}
            className="bg-transparent border-0 p-0 cursor-pointer"
          >
            {action.icon}
          </button>
        ) : null}
      </TooltipIconButton>
    </div>
  );
};

const PlatformCopyButton = ({ text }: { text: string }) => {
  const { IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const platform = usePlatform();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const onClick = useCallback(() => {
    if (!text || !platform.copyToClipboard) return;
    void Promise.resolve(platform.copyToClipboard(text)).then(() => {
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 3000);
    });
  }, [platform, text]);

  return (
    <TooltipIconButton tooltip={t("CopyToClipboard")} onClick={onClick}>
      {copied ? (
        <IconButton iconName="checked" size={24} isStroke disabled />
      ) : (
        <IconButton iconName="btn-copy" size={24} />
      )}
    </TooltipIconButton>
  );
};

const AssistantActionBar = () => {
  const { IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const { useMessageStore } = useStores();
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const platform = usePlatform();
  const { assistantActions } = useWidgetConfig();

  const message = useMessage();

  if (message.status?.type === "incomplete" && message.status?.error) return;

  const onDownload = async () => {
    if (!platform.file) return;

    // Read the messages snapshot lazily so the action bar doesn't
    // re-subscribe to the whole `messages` array on every streaming token.
    const parentMessage =
      useMessageStore.getState().messages[Number(message.parentId)];

    const mdValue = convertMessagesToMd([parentMessage, message]);

    const title = getMessageTitleFromMd(mdValue);

    await platform.file.saveAsFile(mdValue, `${title}.docx`);
  };

  return (
    <ActionBarPrimitive.Root
      hidden={isStreamRunning}
      className="col-start-3 row-start-2 ml-3 mt-3 flex gap-[8px]"
    >
      {platform.copyToClipboard ? (
        <PlatformCopyButton text={getMessageText(message)} />
      ) : (
        <ActionBarPrimitive.Copy asChild>
          <TooltipIconButton tooltip={t("CopyToClipboard")}>
            <MessagePrimitive.If copied>
              <IconButton iconName="checked" size={24} isStroke disabled />
            </MessagePrimitive.If>
            <MessagePrimitive.If copied={false}>
              <IconButton iconName="btn-copy" size={24} />
            </MessagePrimitive.If>
          </TooltipIconButton>
        </ActionBarPrimitive.Copy>
      )}
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip={t("Regenerate")}>
          <IconButton iconName="btn-reset" size={24} isStroke />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <div>
        <TooltipIconButton tooltip={t("Save")}>
          <IconButton
            iconName="btn-save"
            size={24}
            onClick={onDownload}
            isStroke
          />
        </TooltipIconButton>
      </div>
      {assistantActions?.map((action) => (
        <CustomActionButton
          key={action.id}
          action={action}
          message={message as unknown as ThreadMessageLike}
        />
      ))}
    </ActionBarPrimitive.Root>
  );
};

export const AssistantMessage = memo(() => {
  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        className="relative mx-auto grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] px-[var(--thread-padding-x)] py-4"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="assistant"
      >
        <div className="leading-[20px] text-[14px] col-span-2 col-start-2 row-start-1 ml-4 break-words leading-7 text-[var(--chat-message-color)]">
          <MessagePrimitive.Content
            components={{
              tools: { Fallback: ToolFallback },
              Reasoning: ThinkingMarkdownText,
              Text: ThinkingMarkdownText,
            }}
          />
          <MessageError />
        </div>

        <AssistantActionBar />
      </motion.div>
    </MessagePrimitive.Root>
  );
});
