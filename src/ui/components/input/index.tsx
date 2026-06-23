import React from "react";
import { cn } from "../../../shared/utils";
import { Icon } from "../icon";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  isError?: boolean;
  icon?: string;
  onClear?: () => void;
};

const INPUT_COLOR = "var(--input-color)";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, isError, icon, onClear, ...props }, ref) => {
    return (
      <div className={`relative ${className}`}>
        {icon && !(props.type === "search" && props.value) && (
          <div className="absolute top-[50%] translate-y-[-50%] end-[10px] w-[20px] h-[20px] flex items-center justify-center">
            <Icon name={icon} size={20} color={INPUT_COLOR} isStroke />
          </div>
        )}
        <input
          ref={ref}
          type={props.type ?? "text"}
          className={cn(
            "h-[24px] rounded-[4px] box-border border border-[var(--input-border-color)]",
            "bg-[var(--input-background-color)]",
            props.disabled
              ? "cursor-not-allowed pointer-events-none opacity-50"
              : "hover:bg-[var(--input-hover-background-color)] hover:border-[var(--input-hover-border-color)]",
            "focus:bg-[var(--input-active-background-color)] focus:border focus:border-[var(--input-active-border-color)]",
            "outline-none",
            "placeholder:text-[var(--input-placeholder-color)] text-[var(--input-color)]",
            "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            "ps-[12px]",
            icon || (props.type === "search" && props.value)
              ? "pe-[40px]"
              : "pe-[2px]",
            className
          )}
          style={{
            border: isError ? "1px solid var(--input-error-color)" : "",
          }}
          value={props.value}
          spellCheck={false}
          {...props}
        ></input>
        {props.type === "search" && props.value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute top-[50%] translate-y-[-50%] end-[10px] w-[20px] h-[20px] flex items-center justify-center cursor-pointer"
          >
            <Icon name="clear.search" size={20} color={INPUT_COLOR} isStroke />
          </button>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
