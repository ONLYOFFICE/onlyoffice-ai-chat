import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "../../shared/mcp-item";
import type { Profile } from "../types";

/**
 * Caller-supplied override for an action's baked-in system prompt.
 *
 * - `replace` — swap the default out entirely.
 * - `append` — keep the default, add `text` after a blank line.
 *
 * The `custom` action ignores this field; it already takes a raw
 * `systemPrompt: string`.
 */
export type SystemPromptOverride =
  | { mode: "replace"; text: string }
  | { mode: "append"; text: string };

export type ActionArgs = {
  profile: Pick<
    Profile,
    "providerType" | "baseUrl" | "key" | "modelId" | "canUseTool"
  >;
  messages: ThreadMessageLike[];
  tools?: TMCPItem[];
  isReasoning?: boolean;
  signal?: AbortSignal;
  prompt?: SystemPromptOverride;
};
