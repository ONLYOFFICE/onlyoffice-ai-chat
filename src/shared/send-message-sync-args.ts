import type { ThreadMessageLike } from "@assistant-ui/react";

export type SendMessageSyncArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  /**
   * Route the one-shot call through the OpenAI Responses API
   * (`/v1/responses`) instead of Chat Completions. Reasoning models
   * (gpt-5+) reject Chat Completions for some configurations, so callers
   * wire this from `profile.useResponsesApi`. Ignored by providers that
   * don't implement a Responses transport.
   */
  useResponsesApi?: boolean;
  signal?: AbortSignal;
};
