import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "./mcp-item";
import type { ReasoningLevel } from "./reasoning-level";

export type SendMessageArgs = {
  messages: ThreadMessageLike[];
  model: string;
  systemPrompt: string;
  tools?: TMCPItem[];
  /**
   * Legacy on/off switch for extended thinking. Superseded by
   * {@link reasoningLevel}; when both are set the level wins.
   */
  withReasoning?: boolean;
  /**
   * Depth of extended thinking for this round. Providers clamp it to what
   * the model accepts; `"off"` disables thinking where possible.
   */
  reasoningLevel?: ReasoningLevel;
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
