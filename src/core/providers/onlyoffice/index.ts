import type OpenAI from "openai";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { withCacheControl } from "./cache-control";
import { onlyOfficeInfo } from "./info";
import { listModels } from "./models";

/** Header carrying the current thread id to the ONLYOFFICE AI route. */
const SESSION_HEADER = "x-session-id";

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
    withReasoning?: boolean;
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
