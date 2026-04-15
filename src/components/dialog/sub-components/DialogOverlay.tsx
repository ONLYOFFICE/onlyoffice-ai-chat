import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";
import { cn } from "../../../lib/utils";

export type DialogOverlayProps = React.ComponentProps<
  typeof DialogPrimitive.Overlay
>;

const DialogOverlay = ({ className, ...props }: DialogOverlayProps) => {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[var(--modal-dialog-overlay-background)]",
        className
      )}
      {...props}
    />
  );
};

export { DialogOverlay };
