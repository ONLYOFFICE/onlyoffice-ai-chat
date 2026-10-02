import * as ToastPrimitive from "@radix-ui/react-toast";
import type React from "react";
import { cn } from "../../../../shared/utils";
import { useI18n } from "../../../providers/LocalesProvider";
import { Icon } from "../../icon";

export type ToastContentProps = Omit<
  React.ComponentProps<typeof ToastPrimitive.Root>,
  "title"
> & {
  /**
   * The line the toast shows. Widened from Radix's own `title` (a plain
   * string used as the accessible label) so a caller can pass marked-up text
   * — the folder name in "Prompt saved to …" is rendered in its own weight.
   */
  title: React.ReactNode;
  /** Bold line above `title`, e.g. "API key saved." over its explanation. */
  heading?: string;
};

/**
 * One toast card with a close cross. Deliberately presentation-only: it is positioned by the
 * viewport, not by itself, so a stack of them lays out as a column.
 *
 * Every colour, radius and shadow comes from a `--toast-*` variable so a host
 * (DocSpace) can restyle the whole thing to its own design without replacing
 * the component — the defaults below match the editors' look.
 */
const ToastContent = ({
  className,
  title,
  heading,
  ...props
}: ToastContentProps) => {
  const { t, direction } = useI18n();
  return (
    <ToastPrimitive.Root
      dir={direction}
      data-slot="toast"
      data-testid="toast"
      className={cn(
        "pointer-events-auto select-none w-max max-w-full",
        "flex items-center gap-[var(--toast-gap,16px)]",
        "px-[var(--toast-padding-x,16px)] py-[var(--toast-padding-y,8px)]",
        "rounded-[var(--toast-border-radius,4px)]",
        "border border-[var(--toast-border-color)]",
        "bg-[var(--toast-background-color)] text-[var(--toast-text-color)]",
        "shadow-[var(--toast-shadow)]",
        // A fixed size, not a `--fs-*` step: the scale is derived from
        // `--aui-font-base`, and the toast is specced at 14px flat.
        "text-[length:var(--toast-font-size,14px)] leading-[var(--toast-line-height,20px)] font-[400]",
        // Radix drives these states; the motion is a short fade so a toast
        // that replaces another one doesn't read as a jump.
        "data-[state=open]:animate-[toast-in_150ms_ease-out]",
        "data-[state=closed]:animate-[toast-out_100ms_ease-in]",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* With a heading, the heading is the toast's title and `title` drops
            to its description, so screen readers announce them in that order. */}
        {heading ? (
          <>
            <ToastPrimitive.Title className="font-[700] wrap-anywhere">
              {heading}
            </ToastPrimitive.Title>
            <ToastPrimitive.Description className="whitespace-pre-line wrap-anywhere">
              {title}
            </ToastPrimitive.Description>
          </>
        ) : (
          <ToastPrimitive.Title className="whitespace-pre-line wrap-anywhere">
            {title}
          </ToastPrimitive.Title>
        )}
      </div>
      {/* Radix's own Close rather than `IconButton` via `asChild`: the latter
          doesn't forward refs, which React 18 consumers would lose. Closing
          goes through `onOpenChange(false)`, same as the timer running out. */}
      <ToastPrimitive.Close
        aria-label={t("Close")}
        data-testid="toast-close-button"
        className={cn(
          "shrink-0 flex items-center justify-center size-[24px] p-0 m-0",
          "border-none bg-transparent cursor-pointer rounded-[4px]",
          "text-[var(--toast-close-color,var(--icon-button-color))]",
          "hover:bg-[var(--icon-button-hover-background-color)]",
          "active:bg-[var(--icon-button-pressed-background-color)]",
          "outline-none focus-visible:outline-none",
          "[&_svg_path]:fill-current"
        )}
      >
        <Icon name="btn-close" size={24} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
};

export { ToastContent };
