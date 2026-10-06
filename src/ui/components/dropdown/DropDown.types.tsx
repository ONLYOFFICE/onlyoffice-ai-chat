import type React from "react";
import type { DropDownItemProps } from "../dropdown-item/DropDownItem.types";

export type DropdownMenuProps = {
  trigger: React.ReactNode;
  items: DropDownItemProps[];
  /**
   * Rows pinned below the list, on top of the list's own row cap
   * (`--dropdown-list-max-height`). `items` scroll inside the menu's height
   * cap; these stay in view at the bottom, so a long list (many profiles)
   * never hides them. Root level only — in drill-down mode a drilled-in
   * level replaces the whole menu, footer included, and a footer row with a
   * `subMenu` drills like any other row.
   */
  footerItems?: DropDownItemProps[];
  headerContent?: React.ReactNode;
  /**
   * Render `headerContent` at the root level only. A heading that names the
   * root list ("Add room context") has nothing to say about a drilled-in
   * level; the search box of a combobox, by contrast, stays on every level.
   */
  headerAtRootOnly?: boolean;
  /**
   * Label the drill-down back row with the parent row's text, so a drilled-in
   * level is headed "‹ nct2.onlyoffice.com" rather than a bare chevron. The
   * labelled row takes a regular row's height and is the level's heading, so
   * the separator under the bare chevron is dropped.
   */
  backRowLabel?: boolean;
  side?: "bottom" | "top" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  contentClassName?: string;
  maxWidth?: number | string;
  /**
   * Height cap for the content; defaults to
   * `min(--dropdown-menu-max-height, available height)` — ten rows unless
   * a host overrides the token.
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
  /** Test hook for the menu panel (the portalled Radix content). */
  "data-testid"?: string;
};
