import type { ThreadMessageLike } from "@assistant-ui/react";

export type SendMessageSyncArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  signal?: AbortSignal;
};
