import type { ReactNode } from "react";

export type TabItem = {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Class on the tabs root (`TabsPrimitive.Root`). */
  className?: string;
  /** Class on the tab-row (`TabsPrimitive.List`) — e.g. per-instance padding. */
  listClassName?: string;
  /** Class on each scrollable panel (`TabsPrimitive.Content`). */
  contentClassName?: string;
  /**
   * Test hook for the root. Each trigger and panel derives its own from it:
   * `<id>-tab-<value>` and `<id>-panel-<value>`. Defaults to `"tabs"`.
   */
  "data-testid"?: string;
};
