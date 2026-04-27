import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { gpt4allInfo } from "./info";
import { checkCredentials, listModels } from "./models";

/**
 * GPT4All — locally-hosted models via its OpenAI-compatible endpoint.
 *
 * Substitutes a dummy key and defaults the base URL to the canonical
 * GPT4All local server when neither is provided.
 */
class GPT4AllProvider extends OpenAIProvider {
  constructor(creds: ProviderCredentials) {
    super({
      baseUrl: creds.baseUrl || gpt4allInfo.baseUrl,
      apiKey: creds.apiKey || "gpt4all",
    });
  }

  static override getName(): string {
    return gpt4allInfo.name;
  }

  static override getBaseUrl(): string {
    return gpt4allInfo.baseUrl;
  }

  static override async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    return checkCredentials(creds);
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { GPT4AllProvider };
