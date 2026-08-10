import { memo } from "react";
import { cn } from "../../../shared/utils";
import { Icon } from "../icon";
import type { IconButtonProps } from "./IconButton.types";

const IconButtonComponent = ({
  iconName,
  size,
  isStroke,
  isActive,
  className,
  insideElement,
  disableHover,
  color,
  noColor,
  width,
  height,
  ...props
}: IconButtonProps) => {
  const hoverStyles = !disableHover
    ? insideElement
      ? "hover:enabled:bg-[var(--icon-button-hover-on-active-background-color)]"
      : "hover:enabled:bg-[var(--icon-button-hover-background-color)]"
    : undefined;

  const activeStyles = !disableHover
    ? "active:enabled:bg-[var(--icon-button-pressed-background-color)]"
    : undefined;

  const baseStyles =
    "icon-button border-none cursor-pointer rounded-[4px] border-none bg-none bg-transparent p-0 m-0 text-[var(--icon-button-color)]";
  const layoutStyles = "flex items-center justify-center";
  const disabledStyles = "disabled:cursor-not-allowed disabled:opacity-[0.5]";
  const focusStyles =
    "outline-none focus:outline-none focus-visible:outline-none";

  // Recolor the icon from the button's text color (currentColor), so `text-*`
  // and hover utilities passed via `className` drive it. Skipped when the
  // caller pins an explicit `color` (e.g. the composer send/stop button) or
  // opts out with `noColor` (self-colored icons) — those keep the color that
  // `Icon`/`applySvgColor` applies directly and must not be forced to
  // currentColor.
  const iconColorStyles =
    color || noColor
      ? undefined
      : "[&_svg_path]:fill-current [&_svg_path[stroke]]:fill-none [&_svg_path[stroke]]:stroke-current";

  const dim = `${size}px`;

  return (
    <button
      // Icon buttons render inside forms (the chat composer is a <form>,
      // so are the dialog bodies) where a bare <button> defaults to
      // type="submit" — a click on "+"/prompts/remove-attachment would
      // submit the form and send the message. Default to a non-submitting
      // button; callers can still override via an explicit `type` prop.
      type="button"
      className={cn(
        baseStyles,
        layoutStyles,
        hoverStyles,
        activeStyles,
        disabledStyles,
        focusStyles,
        iconColorStyles,
        className
      )}
      style={{
        width: dim,
        minWidth: dim,
        height: dim,
        ...(isActive
          ? {
              backgroundColor: "var(--icon-button-pressed-background-color)",
            }
          : {}),
      }}
      {...props}
    >
      <Icon
        name={iconName}
        size={size}
        isStroke={isStroke}
        color={color}
        noColor={noColor}
        width={width}
        height={height}
      />
    </button>
  );
};

const IconButton = memo(IconButtonComponent);
export { IconButton };
