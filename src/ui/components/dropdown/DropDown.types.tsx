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
  matchTriggerWidth?: boolean;
  open?: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  onOpenChange?: (open: boolean) => void;
  /**
   * Visual context propagated to every rendered item. Defaults to "menu";
   * `ComboBox` sets "combobox" to keep the symmetric trigger-matching padding.
   */
  variant?: "menu" | "combobox";
};
