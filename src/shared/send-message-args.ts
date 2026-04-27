import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "./mcp-item";

export type SendMessageArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  tools?: TMCPItem[];
  withReasoning?: boolean;
  signal?: AbortSignal;
};

export type SendMessageResult =
  | ThreadMessageLike
  | { isEnd: true; responseMessage: ThreadMessageLike };
