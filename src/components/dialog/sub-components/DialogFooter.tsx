import type React from "react";
import { useI18n } from "../../../locales";
import { cn } from "../../../lib/utils";

export type DialogFooterProps = React.ComponentProps<"div">;

const DialogFooter = ({ className, ...props }: DialogFooterProps) => {
  const { isRTL } = useI18n();

  return (
    <div
      dir="rtl"
      data-slot="dialog-footer"
      className={cn(
        "flex gap-2",
        isRTL ? "flex-row-reverse justify-end" : "flex-row justify-start",
        className
      )}
      {...props}
    />
  );
};

export { DialogFooter };
