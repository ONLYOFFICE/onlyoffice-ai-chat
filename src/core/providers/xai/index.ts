import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { xaiInfo } from "./info";
import { listModels } from "./models";

/**
 * xAI (Grok) — OpenAI-compatible API. Inherits the chat/sync pipeline
 * from {@link OpenAIProvider}; overrides static identity and the model
 * list (Grok has its own capability heuristics).
 */
class XAIProvider extends OpenAIProvider {
  static override getName(): string {
    return xaiInfo.name;
  }

  static override getBaseUrl(): string {
    return xaiInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { XAIProvider };
