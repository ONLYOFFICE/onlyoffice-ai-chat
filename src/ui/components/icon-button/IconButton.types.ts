import type { ButtonHTMLAttributes } from "react";

export type IconButtonProps = {
  iconName: string;
  /** Icon/button box size in pixels. */
  size: number;
  color?: string;
  isStroke?: boolean;
  isActive?: boolean;
  insideElement?: boolean;
  disableHover?: boolean;
  noColor?: boolean;
  /** Icon width override, in pixels. */
  width?: number;
  /** Icon height override, in pixels. */
  height?: number;
} & ButtonHTMLAttributes<HTMLButtonElement>;
