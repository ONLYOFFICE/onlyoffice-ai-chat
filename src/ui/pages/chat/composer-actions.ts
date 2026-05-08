import type { ReactNode } from "react";
import type { IconName } from "../../providers/ImagesProvider";

export interface ComposerAction {
  id: string;
  text: string;
  icon?: IconName | (string & {}) | ReactNode;
  onClick: () => void | Promise<void>;
}
