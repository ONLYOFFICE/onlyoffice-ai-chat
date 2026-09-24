import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { lmStudioInfo } from "./info";
import { checkCredentials, listModels } from "./models";

/**
 * LM Studio — locally-hosted models via its OpenAI-compatible server.
 *
 * The local server doesn't require an API key; the constructor
 * substitutes a dummy when one isn't supplied so the OpenAI SDK
 * constructs cleanly.
 */
class LMStudioProvider extends OpenAIProvider {
  /**
   * LM Studio serves the same local models as Ollama and leaks thinking
   * into `content` the same way — see {@link OpenAIProvider.splitInlineReasoning}.
   */
  protected override splitInlineReasoning = true;

  constructor(creds: ProviderCredentials) {
    super({ ...creds, apiKey: creds.apiKey || "lm-studio" });
  }

  static override getName(): string {
    return lmStudioInfo.name;
  }

  static override getBaseUrl(): string {
    return lmStudioInfo.baseUrl;
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

export { LMStudioProvider };
