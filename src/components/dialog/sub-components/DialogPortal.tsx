import * as DialogPrimitive from "@radix-ui/react-dialog";
import type React from "react";
import { useTheme } from "../../../theme";

const DialogPortal = ({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) => {
  const { portalContainer } = useTheme();
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      container={portalContainer ?? undefined}
      {...props}
    />
  );
};

export { DialogPortal };
