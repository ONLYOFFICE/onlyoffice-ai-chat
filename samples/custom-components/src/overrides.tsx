import { forwardRef } from "react";
import type {
  ButtonProps,
  InputProps,
  ToggleButtonProps,
  LoaderProps,
} from "@onlyoffice/ai-chat";
import type { ComponentOverrides } from "@onlyoffice/ai-chat";

const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, style, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      style={{
        ...style,
        borderRadius: 20,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontSize: 11,
      }}
    >
      {children}
    </button>
  )
);
CustomButton.displayName = "CustomButton";

const CustomInput = forwardRef<HTMLInputElement, InputProps>(
  ({ isError, icon: _icon, onClear: _onClear, style, ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      style={{
        ...style,
        borderRadius: 20,
        padding: "8px 16px",
        outline: "none",
        border: isError ? "2px solid #ff6b6b" : "2px solid #7c5cfc",
        background: "transparent",
        color: "inherit",
        width: "100%",
        boxSizing: "border-box",
        fontSize: 13,
      }}
    />
  )
);
CustomInput.displayName = "CustomInput";

function CustomToggleButton({
  checked,
  onCheckedChange,
  disabled,
  id,
}: ToggleButtonProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      style={{
        width: 48,
        height: 26,
        borderRadius: 13,
        border: "2px solid",
        borderColor: checked ? "#7c5cfc" : "#888",
        background: checked ? "#7c5cfc" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "all 0.2s",
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: checked ? "#fff" : "#888",
          position: "absolute",
          top: 2,
          left: checked ? 24 : 2,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

function CustomLoader({ size = 20 }: LoaderProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "3px solid #7c5cfc33",
        borderTop: "3px solid #7c5cfc",
        borderRadius: "50%",
        animation: "custom-spin 0.8s linear infinite",
      }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const overrides: Partial<ComponentOverrides> = {
  Button: CustomButton as any,
  Input: CustomInput as any,
  ToggleButton: CustomToggleButton,
  Loader: CustomLoader,
};

export const overrideSlots: { name: string; overridden: boolean }[] = [
  { name: "Button", overridden: true },
  { name: "IconButton", overridden: false },
  { name: "Input", overridden: true },
  { name: "Checkbox", overridden: false },
  { name: "RadioButton", overridden: false },
  { name: "ToggleButton", overridden: true },
  { name: "ComboBox", overridden: false },
  { name: "DialogContent", overridden: false },
  { name: "DialogOverlay", overridden: false },
  { name: "DialogFooter", overridden: false },
  { name: "DropdownMenu", overridden: false },
  { name: "DropDownItem", overridden: false },
  { name: "Tabs", overridden: false },
  { name: "TooltipContent", overridden: false },
  { name: "TooltipIconButton", overridden: false },
  { name: "Link", overridden: false },
  { name: "Loader", overridden: true },
  { name: "FieldContainer", overridden: false },
];
