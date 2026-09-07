import type { ReactNode } from "react";
import type { TooltipContentProps } from "../tooltip";

export type HelpButtonProps = {
  /** Popover body. May contain links, buttons and other interactive nodes. */
  content: ReactNode;
  /** Trigger icon. Defaults to the standard "i" glyph. */
  iconName?: string;
  /** Trigger box size in pixels. Defaults to the widget's `aboutButtonSize`. */
  size?: number;
  /** Preferred side of the trigger to render the popover on. */
  side?: TooltipContentProps["side"];
  /** Alignment against the trigger. */
  align?: TooltipContentProps["align"];
  /** Distance in pixels between the trigger and the popover. */
  sideOffset?: TooltipContentProps["sideOffset"];
  /** Extra classes for the popover surface. */
  className?: string;
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  /** Controlled open state. Leave unset for an uncontrolled popover. */
  open?: boolean;
  /** Initial open state in uncontrolled mode. */
  defaultOpen?: boolean;
  /** Called whenever the popover wants to open or close. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Accessible name for the trigger. Also replaces the screen-reader copy of
   * `content`, which otherwise duplicates any focusable node inside it.
   */
  "aria-label"?: string;
};
