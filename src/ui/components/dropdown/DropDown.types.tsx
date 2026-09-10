import type React from "react";
import type { DropDownItemProps } from "../dropdown-item/DropDownItem.types";

export type DropdownMenuProps = {
  trigger: React.ReactNode;
  items: DropDownItemProps[];
  headerContent?: React.ReactNode;
  side?: "bottom" | "top" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  contentClassName?: string;
  maxWidth?: number | string;
  /**
   * Height cap for the content; defaults to `min(14rem, available height)`.
   * A drilled-in level takes its parent row's `subMenuMaxHeight` when set.
   */
  maxHeight?: number | string;
  matchTriggerWidth?: boolean;
  open?: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  onOpenChange?: (open: boolean) => void;
  /**
   * Visual context propagated to every rendered item. Defaults to "menu";
   * `ComboBox` sets "combobox" to keep the symmetric trigger-matching padding.
   */
  variant?: "menu" | "combobox";
  /**
   * Overrides the global `WidgetConfig.dropdownNavigation` for this menu.
   * - `"flyout"` — nested submenus open as side flyouts (the historical
   *   behavior).
   * - `"drilldown"` — submenus replace the current level in place, with a
   *   "back" row to return.
   * When omitted, falls back to the widget config, then to `"flyout"`.
   */
  navigation?: "flyout" | "drilldown";
  /**
   * Radix `modal` for this menu; defaults to `true`. A modal menu locks
   * pointer events everywhere outside its own content, including a parent
   * menu it is nested in. A flyout submenu passes `false` so the parent's
   * rows — and the controls on them — stay clickable while it is open.
   */
  modal?: boolean;
};
