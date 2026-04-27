import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { deepseekInfo } from "./info";
import { listModels } from "./models";

/**
 * DeepSeek — OpenAI-compatible API. Inherits the full sendMessage /
 * sendMessageSync pipeline from {@link OpenAIProvider}; overrides only
 * static identity and the model list.
 */
class DeepSeekProvider extends OpenAIProvider {
  static override getName(): string {
    return deepseekInfo.name;
  }

  static override getBaseUrl(): string {
    return deepseekInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { DeepSeekProvider };
