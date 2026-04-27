import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { ollamaInfo } from "./info";
import { checkCredentials, listModels } from "./models";

/**
 * Ollama — locally-hosted models via its OpenAI-compatible endpoint.
 *
 * The local server doesn't require an API key; the constructor
 * substitutes a dummy when one isn't supplied so the OpenAI SDK, which
 * requires a non-empty string, still constructs cleanly.
 */
class OllamaProvider extends OpenAIProvider {
  constructor(creds: ProviderCredentials) {
    super({ ...creds, apiKey: creds.apiKey || "ollama" });
  }

  static override getName(): string {
    return ollamaInfo.name;
  }

  static override getBaseUrl(): string {
    return ollamaInfo.baseUrl;
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

export { OllamaProvider };
