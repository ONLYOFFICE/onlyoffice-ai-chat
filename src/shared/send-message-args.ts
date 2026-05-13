import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "./mcp-item";

export type SendMessageArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  tools?: TMCPItem[];
  withReasoning?: boolean;
  /**
   * When `true`, the provider must route the call through OpenAI's
   * Responses API (`/v1/responses`) instead of Chat Completions. Set by
   * the action layer from `profile.useResponsesApi` after the live probe.
   * Providers that do not implement this path may ignore the flag.
   */
  useResponsesApi?: boolean;
  signal?: AbortSignal;
};

export type SendMessageResult =
  | ThreadMessageLike
  | { isEnd: true; responseMessage: ThreadMessageLike };
