import { cva } from "class-variance-authority";
import { cn } from "../../../shared/utils";

// Base styles
const baseStyles =
  "inline-flex items-center justify-center rounded-[var(--button-border-radius,4px)] min-w-[var(--button-min-width,40px)]";
const focusStyles =
  "outline-none focus:outline-none focus-visible:outline-none";

// Default variant styles
const defaultBaseStyles =
  "bg-[var(--button-default-background-color)] border border-[var(--button-default-border-color)] text-[var(--button-default-color)] [font-weight:var(--button-default-font-weight,400)]";
const defaultHoverStyles =
  "hover:enabled:bg-[var(--button-default-hover-background-color)]";
const defaultActiveStyles =
  "active:enabled:bg-[var(--button-default-pressed-background-color)]";
const defaultFocusStyles = "focus:shadow-[var(--button-default-focus-shadow)]";
const defaultDisabledStyles =
  "disabled:bg-[var(--button-default-disabled-background-color)] disabled:text-[var(--button-default-disabled-color)] disabled:opacity-40 disabled:cursor-not-allowed";

// Primary variant styles
const primaryBaseStyles =
  "bg-[var(--button-background-color)] text-[var(--button-color)] [font-weight:var(--button-font-weight,700)]";
const primaryHoverStyles =
  "hover:enabled:bg-[var(--button-background-hover-color)]";
const primaryActiveStyles =
  "active:enabled:bg-[var(--button-background-pressed-color)]";
const primaryFocusStyles =
  "focus:bg-[var(--button-background-color)] focus:border-[var(--button-border-focus-color)] focus:shadow-[var(--button-shadow-focus)]";
const primaryDisabledStyles = "disabled:opacity-50 disabled:cursor-not-allowed";

// Size styles

const defaultSizeStyles =
  "h-[var(--button-height,24px)] min-w-[var(--button-min-width,40px)] px-[var(--button-padding-x,8px)] leading-[var(--lh-16)]";

const buttonVariants = cva(`${baseStyles} ${focusStyles}`, {
  variants: {
    variant: {
      default: cn(
        defaultBaseStyles,
        defaultHoverStyles,
        defaultActiveStyles,
        defaultFocusStyles,
        defaultDisabledStyles
      ),
      primary: cn(
        primaryBaseStyles,
        primaryHoverStyles,
        primaryActiveStyles,
        primaryFocusStyles,
        primaryDisabledStyles
      ),
    },
    size: {
      default: defaultSizeStyles,
    },
    scale: {
      default: "w-fit",
      scale: "w-full",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
    scale: "default",
  },
});

export { buttonVariants };
