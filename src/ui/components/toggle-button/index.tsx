import * as Switch from "@radix-ui/react-switch";
import { cn } from "../../../shared/utils";
import type { ToggleButtonProps } from "./ToggleButton.types";

const ToggleButton = ({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  className,
}: ToggleButtonProps) => {
  // Base styles
  const baseStyles =
    "relative inline-flex items-center shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out";
  const focusStyles = "focus:outline-none";
  const disabledStyles = "disabled:cursor-not-allowed disabled:opacity-50";

  // State styles
  const backgroundStyles =
    "bg-[var(--toggle-button-off-background-color)] data-[state=checked]:bg-[var(--toggle-button-background-color)]";
  const borderStyles =
    "border-[var(--toggle-button-off-border-color)] data-[state=checked]:border-transparent";
  const hoverStyles =
    "data-[state=checked]:hover:enabled:bg-[var(--toggle-button-background-hover-color)]";

  // Size styles
  const sizeStyles =
    "w-[var(--toggle-button-track-width)] h-[var(--toggle-button-track-height)]";

  // Thumb styles
  const thumbBaseStyles =
    "pointer-events-none inline-block rounded-full ring-0 transition-transform duration-200 ease-in-out";
  const thumbColorStyles =
    "bg-[var(--toggle-button-off-circle-color)] data-[state=checked]:bg-[var(--toggle-button-circle-color)]";
  const thumbSizeStyles =
    "w-[var(--toggle-button-thumb-size)] h-[var(--toggle-button-thumb-size)] translate-x-[var(--toggle-button-thumb-offset)] data-[state=checked]:translate-x-[var(--toggle-button-thumb-offset-checked)]";

  return (
    <div className="flex items-center gap-2">
      <Switch.Root
        dir="ltr"
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          baseStyles,
          focusStyles,
          disabledStyles,
          backgroundStyles,
          borderStyles,
          hoverStyles,
          sizeStyles,
          className
        )}
      >
        <Switch.Thumb
          className={cn(thumbBaseStyles, thumbColorStyles, thumbSizeStyles)}
        />
      </Switch.Root>
    </div>
  );
};

export { ToggleButton };
