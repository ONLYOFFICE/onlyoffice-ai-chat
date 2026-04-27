import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { togetherInfo } from "./info";
import { listModels } from "./models";

/**
 * Together — multi-model inference via an OpenAI-compatible API.
 * Inherits the chat/sync pipeline from {@link OpenAIProvider}; overrides
 * static identity and the model list (Together exposes a per-model
 * `type` field that drives richer capability classification).
 */
class TogetherProvider extends OpenAIProvider {
  static override getName(): string {
    return togetherInfo.name;
  }

  static override getBaseUrl(): string {
    return togetherInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { TogetherProvider };
