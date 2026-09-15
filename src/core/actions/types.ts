import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "../../shared/mcp-item";
import type { ReasoningLevel } from "../../shared/reasoning-level";
import type { ProviderFetch } from "../../shared/provider-credentials";
import type { SourceMeta } from "../../shared/source-meta";
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
    | "headers"
    | "modelId"
    | "canUseTool"
    | "useResponsesApi"
    | "useProxy"
    | "reasoningSupport"
  >;
  messages: ThreadMessageLike[];
  tools?: TMCPItem[];
  /** Legacy extended-thinking switch; {@link reasoningLevel} wins when set. */
  isReasoning?: boolean;
  /** Depth of extended thinking for the round; providers clamp per model. */
  reasoningLevel?: ReasoningLevel;
  signal?: AbortSignal;
  prompt?: SystemPromptOverride;
  /**
   * Per-server usage notes from the MCP `initialize` handshake, keyed by
   * `serverType` (the same key as {@link TMCPItem.serverType} and the
   * disabled map). A server states these once, at connect time, to
   * describe how its tools are meant to be used; the `chat` action folds
   * them into the system prompt inside a framed, advisory block.
   *
   * Supplied by whoever holds the MCP connection: the UI aggregator for
   * browser-run servers, the host for its own. Keyed per server rather
   * than carried on each tool because that is what they are — one text
   * per server, not per tool.
   *
   * @see appendServerInstructions
   */
  toolInstructions?: Record<string, string>;
  /**
   * Thread the round belongs to. Threaded into
   * {@link ProviderCredentials.sessionId} by {@link providerFor}, which
   * turns it into an `x-session-id` header on the ONLYOFFICE provider.
   * Absent on the thread-less paths (`send`, `sendCustom`), where there is
   * no conversation to correlate.
   */
  threadId?: string;
  /**
   * Host entity the round runs for — typically the agent whose chat this
   * is: `entityId` its identifier, `entityTitle` its display name. Both
   * are supplied by the host through `actionArgs` and travel into
   * {@link ProviderCredentials}, where the ONLYOFFICE provider turns them
   * into the request's `metadata` object. Unrelated to the engine's
   * `entityId` scope token, which never leaves storage.
   */
  entityId?: string;
  entityTitle?: string;
  /**
   * The entry the round is billed to (agent, room, form, folder or file).
   * Resolved by the engine through `AIEngineDeps.resolveSource` when the
   * host wires that hook, otherwise taken from the caller's `actionArgs`.
   * Travels into {@link ProviderCredentials.source}, where the ONLYOFFICE
   * provider turns it into the request's `metadata` object, and into the
   * built-in web-search requests against the ONLYOFFICE gateway.
   */
  source?: SourceMeta;
  /**
   * Custom fetch routed through the host's `fetchProxy`. Set by the
   * engine when {@link ActionArgs.profile.useProxy} is true and the
   * engine was constructed with a `fetchProxy` dep. Threaded into
   * {@link ProviderCredentials.fetch} by {@link providerFor}.
   */
  fetch?: ProviderFetch;
};
