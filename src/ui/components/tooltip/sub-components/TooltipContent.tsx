import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";
import { cn } from "../../../../shared/utils";
import { useTheme } from "../../../providers/ThemeProvider";

import "./TooltipContent.css";

export type TooltipContentProps = React.ComponentProps<
  typeof TooltipPrimitive.Content
> & {
  isAbout?: boolean;
};

const TooltipContent = ({
  className,
  sideOffset = 0,
  children,
  isAbout,
  ...props
}: TooltipContentProps) => {
  const { portalContainer } = useTheme();
  return (
    <TooltipPrimitive.Portal container={portalContainer ?? undefined}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "mt-[4px] z-[9999]",
          "bg-[var(--tooltip-background-color)] text-[var(--tooltip-text-color)] border border-[var(--tooltip-border-color)] p-[4px] rounded-[4px] font-[400] leading-[16px]",
          "whitespace-pre-line",
          isAbout ? "max-w-[272px]" : "",
          className
        )}
        {...props}
      >
        {children}
        {isAbout ? <TooltipPrimitive.Arrow className="tooltip-arrow" /> : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
};

export { TooltipContent };
