import type React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { cn } from "../../../../shared/utils";

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
