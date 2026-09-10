import type OpenAI from "openai";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { ReasoningLevel } from "../../../shared/reasoning-level";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { OpenAIProvider } from "../openai";
import {
  getOpenRouterReasoningSupport,
  openRouterReasoningFields,
} from "../openrouter/reasoning";
import { withCacheControl } from "./cache-control";
import { onlyOfficeInfo } from "./info";
import { listModels } from "./models";

/** Header carrying the current thread id to the ONLYOFFICE AI route. */
const SESSION_HEADER = "x-session-id";

/** Wire keys of the `metadata` object the ONLYOFFICE AI route reads. */
const METADATA_KEYS = {
  entityId: "agent_id",
  entityTitle: "agent_title",
} as const;

/**
 * Fold {@link ProviderCredentials.sessionId} into the credential's
 * headers as `x-session-id`. A no-op when no session id is supplied or
 * when the caller already set the header itself (case-insensitively).
 *
 * @param creds - Credentials as handed to the provider constructor.
 * @returns Credentials whose `headers` carry the session header.
 */
const sessionHeaderCreds = (
  creds: ProviderCredentials
): ProviderCredentials => {
  if (!creds.sessionId) return creds;

  const hasOwn = Object.keys(creds.headers ?? {}).some(
    (k) => k.toLowerCase() === SESSION_HEADER
  );
  if (hasOwn) return creds;

  return {
    ...creds,
    headers: { ...creds.headers, [SESSION_HEADER]: creds.sessionId },
  };
};

/**
 * ONLYOFFICE AI provider — a thin OpenAI-compatible provider for the
 * host's AI route. Like {@link OpenAICompatibleProvider}, it speaks the
 * plain OpenAI wire format with no custom transport or capability
 * heuristics; the caller sees everything the endpoint exposes.
 */
class OnlyOfficeProvider extends OpenAIProvider {
  /**
   * Mid-conversation `system` messages are downgraded to `user`, matching
   * the generic OpenAI-compatible provider's safer wire format.
   */
  protected override downgradeSystem = true;

  /**
   * Attach the round's thread id as `x-session-id` before the SDK client
   * is built, so every request this instance makes carries it. Providers
   * are constructed per action call, so the header always reflects the
   * thread currently being answered. An explicit `x-session-id` in
   * `profile.headers` wins — the host stays able to override it.
   */
  constructor(creds: ProviderCredentials) {
    super(sessionHeaderCreds(creds));
  }

  /**
   * Describe the host entity behind the round — the agent's id and title —
   * as the `metadata` object on every request: streaming chat, Responses
   * API, one-shot actions, and image generation. Keys the backend reads
   * are `agent_id` / `agent_title`; absent credentials drop the whole
   * object rather than sending empty strings.
   */
  protected override extraBody(): Record<string, unknown> {
    const metadata: Record<string, string> = {};
    if (this.creds.entityId) {
      metadata[METADATA_KEYS.entityId] = this.creds.entityId;
    }
    if (this.creds.entityTitle) {
      metadata[METADATA_KEYS.entityTitle] = this.creds.entityTitle;
    }
    return Object.keys(metadata).length > 0 ? { metadata } : {};
  }

  /**
   * The ONLYOFFICE route is a one-to-one proxy in front of OpenRouter: the
   * same `vendor/model` ids and the same unified `reasoning` object, so
   * extended thinking is spelled exactly as {@link OpenRouterProvider}
   * spells it (`effort` per level, `none` where the route can stop, the
   * floor where it cannot) — OpenAI's `reasoning_effort` means nothing
   * behind it. The Responses hook is overridden too so a profile an earlier
   * build probed onto that transport never sends the OpenAI spelling.
   */
  protected override reasoningRequestFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    return openRouterReasoningFields(
      model,
      level,
      this.reasoningSupportFor(model, getOpenRouterReasoningSupport)
    );
  }

  protected override reasoningResponsesFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    return openRouterReasoningFields(
      model,
      level,
      this.reasoningSupportFor(model, getOpenRouterReasoningSupport)
    );
  }

  /**
   * Like OpenRouter, the route stays on `/chat/completions`: that is the
   * endpoint whose unified `reasoning` object has an off switch and streams
   * the thinking back, and the one the proxy forwards one-to-one. The live
   * probe is skipped, and profiles an earlier build probed onto the
   * Responses transport are steered back on every call.
   */
  override async checkResponsesApi(): Promise<boolean> {
    return false;
  }

  override sendMessage(
    args: SendMessageArgs
  ): AsyncGenerator<SendMessageResult> {
    return super.sendMessage({ ...args, useResponsesApi: false });
  }

  override sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    return super.sendMessageSync({ ...args, useResponsesApi: false });
  }

  /**
   * Same request as the base provider, with Anthropic-style prompt-caching
   * breakpoints attached to the message list. The ONLYOFFICE route proxies
   * to Claude, which reuses the static prefix (system prompt + history)
   * only when the request marks it explicitly.
   *
   * Streaming chat only — one-shot actions (`sendMessageSync`) send a
   * single request with no follow-up turn to reuse the cache.
   */
  protected override async getStream(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    model: string;
    tools: OpenAI.Chat.ChatCompletionTool[];
    reasoningLevel: ReasoningLevel;
    signal?: AbortSignal;
  }) {
    return super.getStream({
      ...params,
      messages: withCacheControl(params.messages),
    });
  }

  static override getName(): string {
    return onlyOfficeInfo.name;
  }

  static override getBaseUrl(): string {
    return onlyOfficeInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { OnlyOfficeProvider };
