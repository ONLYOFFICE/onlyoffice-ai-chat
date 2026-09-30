import {
  ActionBarPrimitive,
  MessagePrimitive,
  useAssistantState,
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
import { LoadingDots } from "../../../components/loading-dots";
import { MarkdownContent, MarkdownText } from "../../../components/markdown";
import { ToolFallback } from "../../../components/tool-fallback";
import {
  convertMessagesToMd,
  getMessageTitleFromMd,
} from "../../../../shared/utils";
import { getMessageText, removeSpecialCharacter } from "../../../../utils";
import logger from "../../../../shared/logger";
import { useStores } from "../../../store/context";
import {
  useWidgetConfig,
  type ChatErrorOverride,
} from "../../../../widget-config";
import type { AssistantAction } from "../assistant-actions";

// The reasoning header reads as the same muted aside as a tool call: glyph,
// label, chevron — no chip background, no status glyph of its own.
const REASONING_COLOR = "var(--text-tertiary)";

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
    const { t, isRTL } = useI18n();
    const [isCollapsed, setIsCollapsed] = useState(true);

    // A finalized reasoning part carries the provider's signature in
    // `parentId` (see the reasoning handling in the openai/anthropic streams);
    // while the block is still streaming that field is absent. Running state
    // shows as dots trailing the label — the same cue a running tool call
    // gets — instead of a spinner, and a resolved one simply drops them.
    const isRunning = !parentId;

    return (
      <>
        {type === "reasoning" ? (
          <div
            data-testid="assistant-reasoning"
            className="my-[8px] flex w-full flex-col"
          >
            {/* Unlike a tool call, this row stays interactive while running:
                the thinking already streamed so far is worth reading before
                the block closes. */}
            <div
              data-testid="assistant-reasoning-toggle"
              className="flex items-center gap-[10px] cursor-pointer mb-[8px]"
              onClick={() => setIsCollapsed((val) => !val)}
            >
              <Icon name="btn-thinking" size={24} />
              <span className="min-w-0 truncate font-normal text-[var(--text-tertiary)]">
                {t("Thinking")}
                {isRunning ? <LoadingDots /> : null}
              </span>
              <span className={isRTL && isCollapsed ? "rotate-180" : ""}>
                <Icon
                  name={!isCollapsed ? "arrow.bottom" : "arrow.right"}
                  size={16}
                  width={8}
                  height={8}
                  color={REASONING_COLOR}
                  isStroke
                />
              </span>
            </div>
            {!isCollapsed && (
              <div
                data-testid="assistant-reasoning-content"
                className="ps-[12px] ms-[13px] border-l-[var(--border-divider)] border-l-[1px]"
              >
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
  "insufficient_funds",
  "aborted",
]);

const MessageError = () => {
  const { t } = useI18n();
  const { Button } = useComponents();
  const { formatChatError } = useWidgetConfig();
  const { useThreadsStore } = useStores();
  const threadId = useThreadsStore((s) => s.threadId);
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
  const defaultTitle = LOCALIZED_ERROR_CODES.has(code)
    ? t(`ChatError.${code}`)
    : fallback;
  const defaultDescription = code;

  // Host override: rewrites the box's text and action, never its layout or
  // ARIA role. A throw must not take the chat down with it — log and fall
  // back to the defaults.
  let override: ChatErrorOverride | null = null;
  if (formatChatError) {
    // Hand over a payload that is always well-formed, even when a stale
    // host proxied a string / code-less object: `code` and `message` are
    // the resolved values above, so a host can branch on `payload.code`
    // unconditionally.
    const normalized: ChatErrorPayload = {
      ...(payload && typeof payload === "object" ? payload : null),
      code,
      message: fallback,
    };
    try {
      override =
        formatChatError(normalized, {
          threadId: threadId || undefined,
          defaultTitle,
          defaultDescription,
        }) ?? null;
    } catch (err) {
      logger.error("WidgetConfig.formatChatError failed:", err);
      override = null;
    }
  }

  const title = override?.title ?? defaultTitle;
  const description = override?.description ?? defaultDescription;
  // `action` distinguishes three host intents that `??` would collapse:
  // absent (keep the default Retry), explicitly null (no button — the error
  // is not retryable), or an object (relabel and/or take over the click).
  const action = override?.action;
  const hasButton = action !== null;
  const actionText = action?.text ?? t("Retry");
  const onAction = action?.onClick;

  return (
    // Every built-in theme fills the block and leaves the border
    // transparent. The border is still painted so a host can outline the box
    // through `customTheme` without the widget needing a second layout.
    <div
      role="alert"
      data-testid="chat-error"
      data-error-code={code}
      className="bg-[var(--chat-message-error-background-color)] border border-[var(--chat-message-error-border-color)] rounded-[4px] px-[12px] py-[8px] flex items-center gap-[12px]"
    >
      <div className="min-w-0 flex-1">
        <div
          data-testid="chat-error-title"
          className="text-[var(--chat-message-error-color)] font-semibold"
        >
          {title}
        </div>
        <div
          data-testid="chat-error-description"
          className="text-[var(--chat-message-error-color)] leading-[var(--lh-16)] font-normal opacity-60 mt-[2px]"
        >
          {description}
        </div>
      </div>
      {/* Two button paths, because only the built-in retry needs assistant-ui:
          the Reload primitive supplies the regenerate wiring and disables
          itself mid-round, which a host-owned click neither has nor wants. */}
      {hasButton &&
        (onAction ? (
          <Button
            variant="default"
            className="shrink-0"
            data-testid="chat-error-action-button"
            onClick={() => {
              try {
                onAction();
              } catch (err) {
                logger.error("ChatErrorOverride.action.onClick failed:", err);
              }
            }}
          >
            {actionText}
          </Button>
        ) : (
          // Retry replays the errored turn through the regenerate path: the
          // failed assistant message is dropped and the last user message is
          // re-run from stored history, so nothing is appended and the box
          // disappears. Sending from the composer is untouched and still
          // queues after the error.
          <ActionBarPrimitive.Reload asChild>
            <Button
              variant="default"
              className="shrink-0"
              data-testid="chat-error-retry-button"
            >
              {actionText}
            </Button>
          </ActionBarPrimitive.Reload>
        ))}
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
            data-testid={`assistant-action-${action.id}`}
          />
        ) : isValidElement(action.icon) ? (
          <button
            type="button"
            data-testid={`assistant-action-${action.id}`}
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
  const { chatMessageActionsIconSize = 24 } = useWidgetConfig();
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
    void Promise.resolve(
      platform.copyToClipboard(text, { format: "markdown" })
    ).then(() => {
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 3000);
    });
  }, [platform, text]);

  return (
    <TooltipIconButton
      tooltip={copied ? t("Copied") : t("CopyToClipboard")}
      onClick={onClick}
    >
      {copied ? (
        // `disableHover`, not `disabled`: the latter paints a not-allowed
        // cursor over a button the user just used successfully. The tooltip
        // reports the result instead.
        <IconButton
          iconName="checked"
          size={chatMessageActionsIconSize}
          isStroke
          color="var(--icon-gray-secondary)"
          disableHover
          data-testid="assistant-message-copied-indicator"
        />
      ) : (
        <IconButton
          iconName="btn-copy"
          size={chatMessageActionsIconSize}
          isStroke
          color="var(--icon-gray-secondary)"
          data-testid="assistant-message-copy-button"
        />
      )}
    </TooltipIconButton>
  );
};

/**
 * Copy button for runtimes without a platform clipboard: assistant-ui owns
 * the copied state, so it is read off the assistant store (rather than the
 * legacy `MessageState`, which does not carry `isCopied`) to drive both the
 * icon and the tooltip from one value.
 */
const RuntimeCopyButton = () => {
  const { IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const { chatMessageActionsIconSize = 24 } = useWidgetConfig();
  const isCopied = useAssistantState(({ message }) => message.isCopied);

  return (
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton
        tooltip={isCopied ? t("Copied") : t("CopyToClipboard")}
      >
        {isCopied ? (
          // `disableHover`, not `disabled`: see PlatformCopyButton.
          <IconButton
            iconName="checked"
            size={chatMessageActionsIconSize}
            isStroke
            color="var(--icon-gray-secondary)"
            disableHover
            data-testid="assistant-message-copied-indicator"
          />
        ) : (
          <IconButton
            iconName="btn-copy"
            size={chatMessageActionsIconSize}
            isStroke
            color="var(--icon-gray-secondary)"
            data-testid="assistant-message-copy-button"
          />
        )}
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
  );
};

/**
 * Leaf file name of the first attachment on a message, without its extension,
 * for use as a fallback export title. Mirrors the attachment block forms
 * `UserMessage` renders: the ref form (a JSON `mimeType` carrying `title` /
 * `path`) and the legacy inline form (a JSON `mimeType` carrying `path`).
 *
 * @param message - The user turn that preceded the reply, if any.
 * @returns A sanitized title, or `""` when the message has no named file.
 */
const getAttachmentTitle = (message?: ThreadMessageLike): string => {
  if (!message || !Array.isArray(message.content)) return "";

  for (const part of message.content) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (part.type !== "file" || !("mimeType" in part)) continue;

    let raw = "";
    try {
      const meta = JSON.parse(part.mimeType);
      raw = typeof meta.title === "string" ? meta.title : (meta.path ?? "");
    } catch {
      // Not a marker block: `mimeType` holds an ordinary media type
      // (`image/png`, …) for every attachment that is not one of the two
      // JSON forms, and that is what throws here. The parse *is* the
      // discriminator, so this is the normal path for a plain attachment
      // and must stay silent — logging it would warn on every send.
      continue;
    }
    if (typeof raw !== "string" || raw.length === 0) continue;

    // `path` may be a full local path; keep the leaf, then drop the extension
    // so the export format supplies its own.
    const leaf = raw.split(/[\\/]/).pop() ?? raw;
    const dot = leaf.lastIndexOf(".");
    const base = dot > 0 ? leaf.slice(0, dot) : leaf;

    const title = removeSpecialCharacter(base).trim().substring(0, 30);
    if (title.length > 0) return title;
  }

  return "";
};

const AssistantActionBar = () => {
  const { IconButton, TooltipIconButton } = useComponents();
  const { t } = useI18n();
  const { useMessageStore } = useStores();
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const platform = usePlatform();
  const { assistantActions, chatMessageActionsIconSize = 24 } =
    useWidgetConfig();

  const message = useMessage();

  if (message.status?.type === "incomplete" && message.status?.error) return;

  const onDownload = async () => {
    if (!platform.file?.saveAsFile) return;

    // Read the messages snapshot lazily so the action bar doesn't
    // re-subscribe to the whole `messages` array on every streaming token.
    // `message.parentId` is the user turn's message id (a uuid), not an
    // array index — resolve it by id. Fall back to saving just this reply
    // if the parent can't be found.
    const messages = useMessageStore.getState().messages;
    const parentMessage = messages.find((m) => m.id === message.parentId);

    const exported = parentMessage ? [parentMessage, message] : [message];

    // In debug-export mode this carries the tool calls and reasoning too.
    const mdValue = convertMessagesToMd(exported);

    // An attachment-only send carries an empty text part, so the Markdown
    // starts with a bare `## ` and yields no title — name the file after the
    // attached document instead of handing the host a bare `.docx`.
    // The title is always derived from the prose-only rendering: a debug
    // export can open with a tool-call or reasoning block, which would
    // otherwise name the file after a JSON fragment.
    const title =
      getMessageTitleFromMd(
        convertMessagesToMd(exported, { verbose: false })
      ) ||
      getAttachmentTitle(parentMessage) ||
      removeSpecialCharacter(t("ChatExport"));

    await platform.file.saveAsFile(mdValue, `${title}.docx`);
  };

  return (
    <ActionBarPrimitive.Root
      hidden={isStreamRunning}
      data-testid="assistant-message-actions"
      className="col-span-2 col-start-2 row-start-2 mt-[4px] flex h-fit items-center self-start gap-[var(--chat-assistant-message-actions-gap,2px)]"
    >
      {platform.copyToClipboard ? (
        <PlatformCopyButton text={getMessageText(message)} />
      ) : (
        <RuntimeCopyButton />
      )}
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip={t("Regenerate")}>
          <IconButton
            iconName="btn-reset"
            size={chatMessageActionsIconSize}
            isStroke
            color="var(--icon-gray-secondary)"
            data-testid="assistant-message-regenerate-button"
          />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      {platform.file?.saveAsFile && (
        <div>
          {/* Its own key rather than the shared `Save`, which labels every
              submit button in the widget: this action always exports .docx. */}
          <TooltipIconButton tooltip={t("SaveAsDocx")}>
            <IconButton
              iconName="btn-download"
              size={chatMessageActionsIconSize}
              onClick={onDownload}
              isStroke
              color="var(--icon-gray-secondary)"
              data-testid="assistant-message-download-button"
            />
          </TooltipIconButton>
        </div>
      )}
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

/**
 * Whether the message has anything worth rendering — non-empty text /
 * reasoning, or any non-text part (tool call, image, …).
 */
function hasRenderableContent(content: unknown): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    const p = part as { type?: string; text?: string };
    if (p.type === "text" || p.type === "reasoning") {
      return typeof p.text === "string" && p.text.trim().length > 0;
    }
    return true;
  });
}

export const AssistantMessage = memo(() => {
  const message = useMessage();
  const status = message.status as
    | { type?: string; reason?: string }
    | undefined;

  // Don't render an empty assistant shell. Two cases produce one:
  //   • a user-cancelled turn (stop pressed before any content streamed)
  //     leaves an empty "incomplete" message; and
  //   • the runtime's optimistic placeholder for an in-flight turn is an
  //     empty "running" message — which would otherwise show an empty bubble
  //     alongside our own "Analyzing" indicator.
  // Error turns (reason === "error") still render so their banner shows even
  // with no partial content.
  if (
    !hasRenderableContent(message.content) &&
    ((status?.type === "incomplete" && status?.reason !== "error") ||
      status?.type === "running")
  ) {
    return null;
  }

  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        className="relative mx-auto grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_auto] content-start px-[var(--thread-padding-x)] py-[8px]"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="assistant"
        data-testid="assistant-message"
      >
        <div
          data-testid="assistant-message-content"
          className="col-span-2 col-start-2 row-start-1 break-words leading-7 text-[var(--chat-message-color)] select-text"
        >
          <MessagePrimitive.Content
            components={{
              tools: { Fallback: ToolFallback },
              Reasoning: ThinkingMarkdownText,
              // Normal streaming text uses the block-memoized markdown
              // primitive (same one the static user message uses) so only the
              // changed block re-parses per token — not the whole document.
              // Reasoning keeps the custom collapsible renderer above.
              Text: MarkdownText,
            }}
          />
          <MessageError />
        </div>

        <AssistantActionBar />
      </motion.div>
    </MessagePrimitive.Root>
  );
});
