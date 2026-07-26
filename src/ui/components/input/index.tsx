import React from "react";
import { cn } from "../../../shared/utils";
import { Icon } from "../icon";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  isError?: boolean;
  icon?: string;
  /**
   * Which edge the `icon` sits on. `"end"` (default) keeps the historical
   * behavior: the icon shows at the end edge and is replaced by the clear
   * ("X") button once a search value is present. `"start"` pins the icon to
   * the start edge, where it stays visible while typing, and the clear button
   * always occupies the end edge.
   */
  iconPosition?: "start" | "end";
  onClear?: () => void;
};

const ICON_COLOR = "var(--icon-normal)";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, isError, icon, iconPosition = "end", onClear, ...props },
    ref
  ) => {
    const showClear = props.type === "search" && Boolean(props.value);

    const iconEl = icon ? (
      <div className="shrink-0 w-[24px] h-[24px] flex items-center justify-center">
        <Icon name={icon} size={24} color={ICON_COLOR} isStroke />
      </div>
    ) : null;

    // Start-anchored icons stay put; end-anchored ones yield to the clear button.
    const showStartIcon = iconPosition === "start";
    const showEndIcon = iconPosition === "end" && !showClear;

    // Whether an element actually sits on each edge, so the padding can differ
    // when there's an icon/clear box vs. bare text. The `-with-icon` tokens
    // fall back to the base padding, so unset hosts keep the current behavior.
    const hasLeadingIcon = showStartIcon && Boolean(icon);
    const hasTrailingIcon = showClear || (showEndIcon && Boolean(icon));
    const startPadding = hasLeadingIcon
      ? "ps-[var(--input-padding-start-with-icon,var(--input-padding-start,4px))]"
      : "ps-[var(--input-padding-start,4px)]";
    const endPadding = hasTrailingIcon
      ? "pe-[var(--input-padding-end-with-icon,var(--input-padding-end,2px))]"
      : "pe-[var(--input-padding-end,2px)]";

    return (
      <div
        className={cn(
          "flex items-center gap-[var(--input-gap,0px)] h-[var(--input-height,24px)] rounded-[4px] box-border border",
          startPadding,
          endPadding,
          "border-[var(--input-border-color)] bg-[var(--input-background-color)]",
          props.disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
          "focus-within:bg-[var(--input-active-background-color)] focus-within:border-[var(--input-active-border-color)]",
          className
        )}
        style={{
          border: isError ? "1px solid var(--input-error-color)" : undefined,
        }}
      >
        {showStartIcon && iconEl}
        <input
          ref={ref}
          type={props.type ?? "text"}
          className={cn(
            "min-w-0 flex-1 h-full border-0 bg-transparent p-0 outline-none",
            "placeholder:text-[var(--input-placeholder-color)] text-[var(--input-color)]",
            "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            props.disabled ? "cursor-not-allowed" : ""
          )}
          value={props.value}
          spellCheck={false}
          {...props}
        />
        {showEndIcon && iconEl}
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 w-[24px] h-[24px] flex items-center justify-center cursor-pointer border-none bg-transparent"
          >
            <Icon name="clear.search" size={24} color={ICON_COLOR} isStroke />
          </button>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
