import type React from "react";

export type DropDownItemProps = {
  text: string;
  onClick: (e: Event) => void;

  icon?: string | React.ReactNode;
  iconSize?: number;
  iconColor?: string;

  trailingIcon?: string | React.ReactNode;
  trailingIconSize?: number;
  /**
   * Secondary text pinned to the end of the label area, before the submenu
   * chevron — the current value of a row that opens a picker ("Effort ·
   * Medium").
   */
  trailingText?: string;

  id?: string;
  /** Test hook for the row. Defaults to `"dropdown-item"`. */
  "data-testid"?: string;
  isActive?: boolean;
  isSeparator?: boolean;

  withToggle?: boolean;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
  toggleDisabled?: boolean;

  subMenu?: DropDownItemProps[];
  subMenuClassName?: string;
  /**
   * Height cap for this row's `subMenu` only, replacing the menu's default
   * `min(14rem, available height)`. Applies in both navigation modes — the
   * flyout it opens, or the drilled-in level that replaces the menu. Other
   * levels keep the default.
   */
  subMenuMaxHeight?: number | string;
  subMenuIcon?: string;
  subMenuIconSize?: number;

  checked?: boolean;

  tooltipText?: string;
  /**
   * Show the full `text` in a tooltip when the label is clipped by its
   * ellipsis — for user-named rows (saved prompts, folders) whose names can
   * outgrow the menu width. Ignored when `tooltipText` is set.
   */
  withTruncateTooltip?: boolean;

  withSpace?: boolean;

  /**
   * Visual context the item is rendered in. "combobox" keeps symmetric
   * padding (matching the trigger field); "menu" (default) uses the
   * icon-aware horizontal padding driven by the `--dropdown-item-*`
   * tokens. Set automatically by `DropdownMenu` / `ComboBox`.
   */
  variant?: "menu" | "combobox";

  /**
   * How this row presents its `subMenu`. Set automatically by `DropdownMenu`.
   * - `"flyout"` (default) — the row renders its own nested side flyout.
   * - `"drilldown"` — the row does NOT render a flyout; instead it shows a
   *   drill indicator and calls `onDrill` to ask the parent menu to descend.
   */
  navigation?: "flyout" | "drilldown";
  /**
   * Called when a `"drilldown"` row should descend into its `subMenu`. The
   * parent `DropdownMenu` owns the navigation stack and supplies this.
   */
  onDrill?: () => void;

  withAbout?: boolean;
  aboutContent?: React.ReactNode;
};
