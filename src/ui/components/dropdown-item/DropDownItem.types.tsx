import type React from "react";

export type DropDownItemProps = {
  text: string;
  onClick: (e: Event) => void;

  icon?: string | React.ReactNode;
  iconSize?: number;
  iconColor?: string;

  trailingIcon?: string | React.ReactNode;
  trailingIconSize?: number;

  id?: string;
  isActive?: boolean;
  isSeparator?: boolean;

  withToggle?: boolean;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
  toggleDisabled?: boolean;

  subMenu?: DropDownItemProps[];
  subMenuClassName?: string;
  subMenuIcon?: string;
  subMenuIconSize?: number;

  checked?: boolean;

  tooltipText?: string;

  withSpace?: boolean;

  /**
   * Visual context the item is rendered in. "combobox" keeps symmetric
   * padding (matching the trigger field); "menu" (default) uses the
   * icon-aware horizontal padding driven by the `--dropdown-item-*`
   * tokens. Set automatically by `DropdownMenu` / `ComboBox`.
   */
  variant?: "menu" | "combobox";

  withAbout?: boolean;
  aboutContent?: React.ReactNode;
};
