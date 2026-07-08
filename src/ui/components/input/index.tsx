import React from "react";
import { cn } from "../../../shared/utils";
import { Icon } from "../icon";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  isError?: boolean;
  icon?: string;
  onClear?: () => void;
};

const ICON_COLOR = "var(--icon-normal)";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, isError, icon, onClear, ...props }, ref) => {
    const showClear = props.type === "search" && Boolean(props.value);

    return (
      <div
        className={cn(
          "flex items-center h-[var(--input-height,24px)] rounded-[4px] box-border border ps-[4px] pe-[2px]",
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
        {icon && !showClear && (
          <div className="shrink-0 w-[24px] h-[24px] flex items-center justify-center">
            <Icon name={icon} size={24} color={ICON_COLOR} isStroke />
          </div>
        )}
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
