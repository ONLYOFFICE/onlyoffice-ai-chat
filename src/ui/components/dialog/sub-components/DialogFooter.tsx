import { cn } from "../../../../shared/utils";
import { useI18n } from "../../../providers/LocalesProvider";
import { Button } from "../../button";

export interface DialogFooterProps {
  /** Label for the secondary (cancel) button. */
  cancelLabel: string;
  /** Click handler for the cancel button. */
  onCancel?: VoidFunction;
  /** HTML button type for the cancel button. Defaults to "button". */
  cancelType?: "button" | "submit" | "reset";
  /** Disables the cancel button. */
  cancelDisabled?: boolean;
  /** Label for the primary (submit/confirm) button. */
  submitLabel: string;
  /**
   * Click handler for the submit button. Omit when the button submits an
   * enclosing `<form>` via `submitType="submit"`.
   */
  onSubmit?: VoidFunction;
  /** HTML button type for the submit button. Defaults to "button". */
  submitType?: "button" | "submit" | "reset";
  /** Disables the submit button. */
  submitDisabled?: boolean;
  /** Shows a loading spinner on the submit button (implies disabled). */
  submitLoading?: boolean;
  /** Extra classes for the footer wrapper (height, padding, borders, …). */
  className?: string;
  /** Extra classes applied to both action buttons. */
  buttonClassName?: string;
}

/**
 * Shared dialog footer with a secondary (cancel) and primary (submit) button.
 * The wrapper only owns the common layout (a right-aligned, RTL-aware row);
 * each dialog supplies its own geometry via `className`. Registered in
 * `ComponentsProvider`, so hosts can replace it entirely via the `DialogFooter`
 * override.
 */
const DialogFooter = ({
  cancelLabel,
  onCancel,
  cancelType = "button",
  cancelDisabled,
  submitLabel,
  onSubmit,
  submitType = "button",
  submitDisabled,
  submitLoading,
  className,
  buttonClassName,
}: DialogFooterProps) => {
  const { isRTL } = useI18n();

  return (
    <div
      className={cn(
        "flex items-center gap-[8px]",
        isRTL ? "flex-row-reverse justify-end" : "flex-row justify-end",
        className
      )}
    >
      <Button
        type={cancelType}
        variant="default"
        data-testid="dialog-cancel-button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className={buttonClassName}
      >
        {cancelLabel}
      </Button>
      <Button
        type={submitType}
        data-testid="dialog-submit-button"
        onClick={onSubmit}
        disabled={submitDisabled}
        isLoading={submitLoading}
        className={buttonClassName}
      >
        {submitLabel}
      </Button>
    </div>
  );
};

export { DialogFooter };
