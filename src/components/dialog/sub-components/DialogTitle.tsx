import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";
import { useI18n } from "../../../locales";
import { cn } from "../../../lib/utils";

const DialogTitle = ({
  className,
  withWarningIcon,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & {
  withWarningIcon?: boolean;
}) => {
  const { isRTL } = useI18n();

  return (
    <DialogPrimitive.Title
      dir={isRTL ? "rtl" : "ltr"}
      data-slot="dialog-title"
      className={cn(
        "font-bold text-[var(--modal-dialog-header-color)] select-none",
        className,
        withWarningIcon
          ? "text-[14px] leading-[20px]"
          : "text-[18px] leading-[24px]"
      )}
      {...props}
    />
  );
};

export { DialogTitle };
