import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";
import { useEffect, useState } from "react";
import { TooltipProvider } from "./Provider";

const Tooltip = ({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) => {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Radix closes a hover-opened tooltip only when the trigger receives a
  // `pointerleave` event. When the cursor exits the iframe boundary quickly,
  // that event never reaches the trigger, leaving the tooltip stuck open.
  // Force-close it when the pointer leaves the document or the frame blurs.
  useEffect(() => {
    if (isControlled || !internalOpen) return;

    const close = () => setInternalOpen(false);

    window.addEventListener("blur", close);
    document.documentElement.addEventListener("mouseleave", close);

    return () => {
      window.removeEventListener("blur", close);
      document.documentElement.removeEventListener("mouseleave", close);
    };
  }, [isControlled, internalOpen]);

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={isControlled ? open : internalOpen}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </TooltipProvider>
  );
};

export { Tooltip };
