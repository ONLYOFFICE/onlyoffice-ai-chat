import type { ReactNode } from "react";
import type { IconName } from "../../providers/ImagesProvider";

/**
 * Host-provided entry appended to the composer's model (profile) picker
 * dropdown, after a separator below the profile list.
 *
 * An entry either handles the click itself (`onClick` / `profileId`) or
 * opens a nested submenu (`items`); when `items` is present, the click
 * handlers are ignored.
 */
export interface ProfilePickerAction {
  id: string;
  text: string;
  icon?: IconName | (string & {}) | ReactNode;
  onClick?: () => void | Promise<void>;
  /**
   * Id of a configured profile to select on click. The profile becomes the
   * session chat profile (used by every subsequent request), while the
   * picker displays this entry's `text` instead of the profile's own name —
   * e.g. an AI agent name aliasing the agent's underlying profile. Ignored
   * when the id matches no profile. Combinable with `onClick`, which fires
   * after the selection.
   */
  profileId?: string;
  /** Submenu entries; the row opens a nested menu when set. */
  items?: ProfilePickerAction[];
}
