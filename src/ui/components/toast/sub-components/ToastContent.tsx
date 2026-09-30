import * as ToastPrimitive from "@radix-ui/react-toast";
import type React from "react";
import { cn } from "../../../../shared/utils";
import { useI18n } from "../../../providers/LocalesProvider";

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
};

/**
 * One toast pill. Deliberately presentation-only: it is positioned by the
 * viewport, not by itself, so a stack of them lays out as a column.
 *
 * Every colour, radius and shadow comes from a `--toast-*` variable so a host
 * (DocSpace) can restyle the whole thing to its own design without replacing
 * the component — the defaults below match the editors' look.
 */
const ToastContent = ({ className, title, ...props }: ToastContentProps) => {
  const { direction } = useI18n();
  return (
    <ToastPrimitive.Root
      dir={direction}
      data-slot="toast"
      data-testid="toast"
      className={cn(
        "pointer-events-auto select-none w-max max-w-full",
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
      <ToastPrimitive.Title className="whitespace-pre-line wrap-anywhere">
        {title}
      </ToastPrimitive.Title>
    </ToastPrimitive.Root>
  );
};

export { ToastContent };
