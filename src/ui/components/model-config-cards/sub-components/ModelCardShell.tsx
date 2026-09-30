import type { ReactNode } from "react";
import { cn } from "../../../../shared/utils";

interface ModelCardShellProps {
  children: ReactNode;
  "data-testid"?: string;
}

export const ModelCardShell = ({
  children,
  "data-testid": dataTestId,
}: ModelCardShellProps) => (
  <div
    data-testid={dataTestId}
    className={cn(
      "w-full p-[var(--model-config-card-padding,8px)] flex flex-col",
      "bg-[var(--model-config-card-background-color)]",
      "border-[length:var(--model-config-card-border-width)] border-[color:var(--model-config-card-border-color)]",
      "rounded-[var(--model-config-card-border-radius)]"
    )}
  >
    {children}
  </div>
);
