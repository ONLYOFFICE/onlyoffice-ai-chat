import type { ButtonProps } from "../../components/button";
import type { CheckboxProps } from "../../components/checkbox";
import type { ComboBoxProps } from "../../components/combo-box";
import type {
  DialogContentProps,
  DialogFooterProps,
  DialogOverlayProps,
} from "../../components/dialog";
import type { DropDownItemProps } from "../../components/dropdown-item/DropDownItem.types";
import type { DropdownMenuProps } from "../../components/dropdown/DropDown.types";
import type { FieldContainerProps } from "../../components/field-container";
import type { IconButtonProps } from "../../components/icon-button/IconButton.types";
import type { InputProps } from "../../components/input";
import type { LinkProps } from "../../components/link";
import type { LoaderProps } from "../../components/loader";
import type { RadioButtonProps } from "../../components/radio-button/RadioButton.types";
import type { TabsProps } from "../../components/tabs/Tabs.types";
import type { ToggleButtonProps } from "../../components/toggle-button/ToggleButton.types";
import type { TooltipContentProps } from "../../components/tooltip";
import type { TooltipIconButtonProps } from "../../components/tooltip-icon-button/TooltipIconButton.types";

/**
 * Map of component names to custom React component implementations.
 * Provide overrides here to replace the built-in UI primitives with
 * your own components (e.g. from a design system).
 *
 * @example
 * ```tsx
 * const overrides: ComponentOverrides = {
 *   Button: MyCustomButton,
 *   Input: MyCustomInput,
 * };
 *
 * <AIChatWidget components={overrides} />
 * ```
 */
export interface ComponentOverrides {
  /** Primary action button. */
  Button?: React.ComponentType<ButtonProps>;
  /** Icon-only button. */
  IconButton?: React.ComponentType<IconButtonProps>;
  /** Text input field. */
  Input?: React.ComponentType<InputProps>;
  /** Checkbox toggle. */
  Checkbox?: React.ComponentType<CheckboxProps>;
  /** Radio button option. */
  RadioButton?: React.ComponentType<RadioButtonProps>;
  /** Toggle button switch. */
  ToggleButton?: React.ComponentType<ToggleButtonProps>;
  /** Combo box / select dropdown. */
  ComboBox?: React.ComponentType<ComboBoxProps>;
  /** Dialog body content area. */
  DialogContent?: React.ComponentType<DialogContentProps>;
  /** Dialog backdrop overlay. */
  DialogOverlay?: React.ComponentType<DialogOverlayProps>;
  /** Dialog footer with action buttons. */
  DialogFooter?: React.ComponentType<DialogFooterProps>;
  /** Dropdown menu container. */
  DropdownMenu?: React.ComponentType<DropdownMenuProps>;
  /** Individual item inside a dropdown menu. */
  DropDownItem?: React.ComponentType<DropDownItemProps>;
  /** Tab navigation bar. */
  Tabs?: React.ComponentType<TabsProps>;
  /** Tooltip popup content. */
  TooltipContent?: React.ComponentType<TooltipContentProps>;
  /** Icon button wrapped with a tooltip. */
  TooltipIconButton?: React.ComponentType<TooltipIconButtonProps>;
  /** Hyperlink element. */
  Link?: React.ComponentType<LinkProps>;
  /** Loading spinner / indicator. */
  Loader?: React.ComponentType<LoaderProps>;
  /** Labeled field wrapper with optional error message. */
  FieldContainer?: React.ComponentType<FieldContainerProps>;
}

export type {
  ButtonProps,
  CheckboxProps,
  ComboBoxProps,
  DialogContentProps,
  DialogFooterProps,
  DialogOverlayProps,
  DropDownItemProps,
  DropdownMenuProps,
  FieldContainerProps,
  IconButtonProps,
  InputProps,
  LinkProps,
  LoaderProps,
  RadioButtonProps,
  TabsProps,
  ToggleButtonProps,
  TooltipContentProps,
  TooltipIconButtonProps,
};
