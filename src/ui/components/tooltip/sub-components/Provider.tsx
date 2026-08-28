import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";

/** Hover delay before a tooltip opens, mirroring the native `title` feel. */
export const DEFAULT_TOOLTIP_DELAY_DURATION = 500;

const TooltipProvider = ({
  delayDuration = DEFAULT_TOOLTIP_DELAY_DURATION,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
};

export { TooltipProvider };
