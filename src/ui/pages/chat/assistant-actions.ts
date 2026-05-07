import type { ReactNode } from "react";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { IconName } from "../../providers/ImagesProvider";

export interface AssistantActionContext {
  text: string;
  message: ThreadMessageLike;
  markdown: string;
}

export interface AssistantAction {
  id: string;
  tooltip: string;
  icon: IconName | (string & {}) | ReactNode;
  onClick: (ctx: AssistantActionContext) => void | Promise<void>;
  isVisible?: (ctx: AssistantActionContext) => boolean;
}
