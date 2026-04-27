import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";
import { cn } from "../../../../shared/utils";

export type DialogOverlayProps = React.ComponentProps<
  typeof DialogPrimitive.Overlay
> & {
  /**
   * When true, the overlay covers the portal container (absolute inset-0)
   * instead of the full viewport (fixed inset-0).
   */
  isFullscreen?: boolean;
};

const DialogOverlay = ({
  className,
  isFullscreen,
  ...props
}: DialogOverlayProps) => {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 bg-[var(--modal-dialog-overlay-background)]",
        isFullscreen ? "absolute inset-0" : "fixed inset-0",
        className
      )}
      {...props}
    />
  );
};

export { DialogOverlay };
