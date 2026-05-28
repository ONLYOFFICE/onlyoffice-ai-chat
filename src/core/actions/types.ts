import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "../../shared/mcp-item";
import type { ProviderFetch } from "../../shared/provider-credentials";
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
    | "providerType"
    | "basedOn"
    | "baseUrl"
    | "key"
    | "modelId"
    | "canUseTool"
    | "useResponsesApi"
    | "useProxy"
  >;
  messages: ThreadMessageLike[];
  tools?: TMCPItem[];
  isReasoning?: boolean;
  signal?: AbortSignal;
  prompt?: SystemPromptOverride;
  /**
   * Custom fetch routed through the host's `fetchProxy`. Set by the
   * engine when {@link ActionArgs.profile.useProxy} is true and the
   * engine was constructed with a `fetchProxy` dep. Threaded into
   * {@link ProviderCredentials.fetch} by {@link providerFor}.
   */
  fetch?: ProviderFetch;
};
