import type { TErrorData } from "../../shared/error-data";
import type { ImageGenerationArgs } from "../../shared/image-generation-args";
import type { Model } from "../../shared/model";
import type { ProviderCredentials } from "../../shared/provider-credentials";
import type { ReasoningSupport } from "../../shared/reasoning-level";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../shared/send-message-sync-args";

/**
 * Stateless thin-client contract for an AI provider.
 *
 * Each concrete subclass owns its own SDK client (typed per SDK) and
 * exposes chat / sync / optional image-generation methods that take all
 * per-call data as arguments. The only piece of instance state kept is
 * the credentials that were used to construct the SDK client.
 */
export abstract class AbstractBaseProvider {
  protected creds: ProviderCredentials;

  constructor(creds: ProviderCredentials) {
    this.creds = creds;
  }

  abstract sendMessage(
    args: SendMessageArgs
  ): AsyncGenerator<SendMessageResult>;

  abstract sendMessageSync(args: SendMessageSyncArgs): Promise<string>;

  imageGeneration?(args: ImageGenerationArgs): Promise<string>;

  /**
   * Probe whether this provider/model needs the OpenAI Responses API
   * (`/v1/responses`) instead of Chat Completions. Default `false` —
   * only the genuine OpenAI provider overrides this with a live request.
   * All other subclasses (third-party OpenAI-compatible endpoints) keep
   * the default and never issue a probe request, since their backends
   * do not implement the Responses API.
   */
  async checkResponsesApi(
    _modelId: string,
    _signal?: AbortSignal
  ): Promise<boolean> {
    return false;
  }

  /**
   * The reasoning support a request for `model` must be built against: the
   * profile's catalogue record when the host passed one
   * ({@link ProviderCredentials.reasoningSupport}), else the provider's own
   * id-based `table`. The composer resolves the Effort row from exactly the
   * same pair, so a stored `off` on a route the catalogue marks mandatory
   * becomes the same standard depth on the wire that the row displays —
   * instead of an `effort: "none"` the id table thought was allowed.
   */
  protected reasoningSupportFor(
    model: string,
    table: (model: string) => ReasoningSupport
  ): ReasoningSupport {
    return this.creds.reasoningSupport ?? table(model);
  }
}

/**
 * Static surface every concrete provider class must satisfy. TypeScript
 * cannot mark static methods `abstract`, so the registry and any caller
 * that needs static provider info relies on this companion interface.
 */
export interface ProviderConstructor {
  new (creds: ProviderCredentials): AbstractBaseProvider;

  checkProvider(creds: ProviderCredentials): Promise<boolean | TErrorData>;
  getProviderModels(creds: ProviderCredentials): Promise<Model[]>;
  getName(): string;
  getBaseUrl(): string;
  /**
   * What one of this provider's models can do with extended thinking —
   * which depths it distinguishes and whether it can be switched off. The
   * composer offers only those choices. Optional: a provider that omits it
   * is assumed to think at every depth and to have an off switch. Built-in
   * providers answer from SDK-free tables so the registry can serve the
   * question synchronously — see `getReasoningSupport` in the registry.
   */
  getReasoningSupport?(model: string): ReasoningSupport;
}
