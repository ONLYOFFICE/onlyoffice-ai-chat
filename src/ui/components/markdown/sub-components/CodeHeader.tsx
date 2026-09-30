import type { CodeHeaderProps } from "@assistant-ui/react-markdown";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import useCopyToClipboard from "../hooks/useCopyToClipboard";

const CodeHeader = ({ language, code }: CodeHeaderProps) => {
  const { IconButton, TooltipIconButton } = useComponents();
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  const { t } = useI18n();

  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div
      data-testid="code-block-header"
      className="mt-4 flex items-center justify-between gap-4 rounded-t-lg bg-[var(--chat-message-code-block-background-color)] text-[var(--chat-message-code-block-header-color)] px-[12px] pt-[12px] pb-[8px]"
    >
      <span data-testid="code-block-language" className="lowercase">
        {language}
      </span>
      <TooltipIconButton
        tooltip={isCopied ? t("Copied") : t("CopyToClipboard")}
        onClick={onCopy}
      >
        {!isCopied && (
          <IconButton
            iconName="btn-copy"
            size={24}
            isStroke
            data-testid="code-block-copy-button"
          />
        )}
        {isCopied && (
          <IconButton
            iconName="checked"
            size={24}
            isStroke
            disableHover
            data-testid="code-block-copied-indicator"
          />
        )}
      </TooltipIconButton>
    </div>
  );
};

export default CodeHeader;
