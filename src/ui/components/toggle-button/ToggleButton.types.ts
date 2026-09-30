export type ToggleButtonProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Test hook, placed on the switch itself (carries `data-state`). */
  "data-testid"?: string;
};
