import type { ButtonHTMLAttributes } from "react";

export type IconButtonProps = {
  iconName: string;
  /**
   * Icon/button box size. A `number` is treated as pixels; a string is used
   * verbatim as a CSS length, so a theme token works too — e.g.
   * `"var(--chat-message-actions-icon-size, 20px)"`.
   */
  size: number | string;
  color?: string;
  isStroke?: boolean;
  isActive?: boolean;
  insideElement?: boolean;
  disableHover?: boolean;
  noColor?: boolean;
  /** Icon width override. `number` is pixels; a string is a verbatim CSS length. */
  width?: number | string;
  /** Icon height override. `number` is pixels; a string is a verbatim CSS length. */
  height?: number | string;
} & ButtonHTMLAttributes<HTMLButtonElement>;
