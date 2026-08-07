import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { cn } from "../../../../shared/utils";
import { useWidgetConfig } from "../../../../widget-config";
import { Icon } from "../../icon";
import { IconButton } from "../../icon-button";
import { DialogOverlay } from "./DialogOverlay";
import { DialogPortal } from "./DialogPortal";
import { DialogTitle } from "./DialogTitle";

const HiddenComponents = () => {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Description className="hidden">
      {t("DialogContent")}
    </DialogPrimitive.Description>
  );
};

export type DialogContentProps = React.ComponentProps<
  typeof DialogPrimitive.Content
> & {
  header: string;
  onClose: VoidFunction;
  isHuge?: boolean;
  withWarningIcon?: boolean;
  /**
   * Renders the dialog filling 100% of the portal container (no rounded
   * corners, no centered sizing) and hides the close button in the header.
   * Takes precedence over `isHuge` and `withWarningIcon` for sizing.
   */
  isFullscreen?: boolean;
};

const widthDefaultStyles = "w-[348px]";
const widthHugeStyles = "w-[548px]";
const centeredSizeStyles =
  " box-border h-fit-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 rounded-[8px]";
const warningSizeStyles =
  "w-[352px] box-border h-fit-content fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 rounded-[8px]";
const fullscreenSizeStyles = "absolute inset-0 z-50 box-border overflow-hidden";
/**
 * Always applied — ensures hardcoded pixel widths (`w-[548px]`, `w-[700px]`,
 * or anything passed via `className`) never exceed the portal container.
 */
const clampStyles = "max-w-full max-h-full";
const colorStyles =
  "bg-[var(--modal-dialog-background-color)]  shadow-[var(--modal-dialog-shadows)]";

const DialogContent = ({
  className,
  children,
  header,
  onClose,
  isHuge = false,
  withWarningIcon = false,
  isFullscreen,
  ...props
}: DialogContentProps) => {
  const { isRTL } = useI18n();
  const { isDialogFullscreen } = useWidgetConfig();
  const fullscreen = isFullscreen ?? isDialogFullscreen ?? false;
  const widthStyles = fullscreen
    ? ""
    : isHuge
      ? widthHugeStyles
      : widthDefaultStyles;
  const sizeStyles = fullscreen
    ? fullscreenSizeStyles
    : withWarningIcon
      ? warningSizeStyles
      : centeredSizeStyles;

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay isFullscreen={fullscreen} style={{ zIndex: 300 }} />
      <DialogPrimitive.Content
        id="dialog-content"
        data-slot="dialog-content"
        dir={isRTL ? "rtl" : "ltr"}
        className={cn(
          widthStyles,
          sizeStyles,
          colorStyles,
          "flex flex-col",
          className,
          clampStyles
        )}
        onInteractOutside={(e) => e.preventDefault()}
        {...props}
        style={{ zIndex: 300, ...props.style }}
      >
        <HiddenComponents />
        <div
          className={cn(
            "flex items-center justify-between align-center",
            withWarningIcon ? "h-[40px]" : "h-[56px]",
            withWarningIcon ? "ps-[16px] pe-[8px]" : "ps-[32px] pe-[16px]"
          )}
        >
          <div className="flex items-center gap-[4px]">
            {withWarningIcon ? (
              <Icon name="attention" size={20} noColor />
            ) : null}
            <DialogTitle withWarningIcon={withWarningIcon}>
              {header}
            </DialogTitle>
          </div>
          {!fullscreen ? (
            <IconButton iconName="btn-close" size={24} onClick={onClose} />
          ) : null}
        </div>
        <div
          className={cn(
            "flex-1 min-h-0",
            withWarningIcon ? "px-[16px]" : "px-[32px]"
          )}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

export { DialogContent };
