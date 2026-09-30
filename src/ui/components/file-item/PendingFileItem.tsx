import { useState } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { useComponents } from "../../providers/ComponentsProvider";
import { cn, getFileIconName } from "../../../shared/utils";
import type { TPendingAttachment } from "../../store/create-attachments-store";
import { Icon } from "../icon";
import { IconButton } from "../icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { chipClassName } from "./chip";

/**
 * Loading chip for a {@link TPendingAttachment}: same box, height and icon
 * as the settled `FileItem` (via the shared {@link chipClassName}), with an
 * indeterminate spinner where the close button sits — so nothing shifts
 * when the real chip replaces it. No preview for pending images: the
 * payload does not exist yet, and a grey box that later becomes a
 * thumbnail reads as a glitch, whereas the file icon + name is honest.
 *
 * Hovering swaps the spinner for a close button. Dismissing only revokes
 * the lease —
 * the attachment never joins the draft — it does not abort the underlying
 * production (a portal upload still completes and the file stays in the
 * user's folder).
 */
type PendingFileItemProps = {
  item: TPendingAttachment;
  /** Omit to render a non-dismissible chip. */
  onCancel?: (id: string) => void;
};

const PendingFileItem = ({ item, onCancel }: PendingFileItemProps) => {
  const { t, isRTL } = useI18n();
  const { Loader } = useComponents();
  const [hovered, setHovered] = useState(false);

  const extension = item.title.split(".").pop() ?? "";
  const nameWithoutExtension = item.title.replace(`.${extension}`, "");
  const showCancel = Boolean(onCancel) && hovered;

  const chip = (
    <div
      className={cn(chipClassName({ isRTL }), "opacity-70")}
      role="status"
      aria-busy
      aria-label={`${item.title} — ${t("Uploading")}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="pending-file-item"
    >
      <div className="flex flex-row items-center h-[24px] gap-[4px] min-w-0">
        <Icon
          name={getFileIconName(item.type ?? 0)}
          size={24}
          noColor
          className="shrink-0"
        />
        <p className="text-[var(--file-items-color)] font-normal whitespace-nowrap overflow-hidden text-ellipsis">
          {nameWithoutExtension}
          <span className="text-[var(--file-items-ext-color)]">
            .{extension}
          </span>
        </p>
      </div>
      {showCancel ? (
        <IconButton
          iconName="btn-close.small"
          size={16}
          aria-label={t("Cancel")}
          data-testid="pending-file-item-cancel-button"
          onClick={() => onCancel?.(item.id)}
        />
      ) : (
        <Loader size={16} />
      )}
    </div>
  );

  // Matches `FileItem`: the name truncates, so the full one lives in a
  // tooltip. This replaces the native `title` attribute the chip used to
  // carry — keeping both would stack two tooltips on the same hover.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent
        className="max-w-[var(--file-item-tooltip-max-width,280px)] break-words"
        side="top"
        align="start"
      >
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
};

export { PendingFileItem };
