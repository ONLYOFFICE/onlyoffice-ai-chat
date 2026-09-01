import { cn } from "../../../shared/utils";

/**
 * The attachment-chip box, styled in exactly one place so the settled
 * `FileItem` and the loading `PendingFileItem` cannot drift in size — the
 * swap placeholder → real chip must be visually seamless (same height,
 * radius, padding), otherwise the whole row jumps when an upload lands.
 */
export const chipClassName = ({
  isImage,
  withoutClose,
  isRTL,
}: {
  isImage?: boolean;
  withoutClose?: boolean;
  isRTL?: boolean;
}) =>
  cn(
    "w-fit flex flex-row items-center gap-[12px] h-[36px] rounded-[8px] box-border border-[var(--file-items-border-color)]",
    withoutClose
      ? ""
      : "grow shrink-0 basis-[var(--file-item-min-width,120px)] max-w-max min-w-0 cursor-default",
    isImage ? (isRTL ? "p-0 pl-[4px]" : "p-0 pr-[4px]") : "p-[4px]",
    withoutClose
      ? isRTL
        ? "cursor-pointer pl-[24px]"
        : "cursor-pointer pr-[24px]"
      : "",
    withoutClose
      ? "bg-[var(--file-items-chat-background-color)]"
      : "border bg-[var(--file-items-background-color)]",
    withoutClose
      ? "hover:bg-[var(--file-items-chat-hover-background-color)]"
      : "",
    withoutClose
      ? "active:bg-[var(--file-items-chat-pressed-background-color)]"
      : ""
  );
