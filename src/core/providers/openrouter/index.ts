import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { openrouterInfo } from "./info";
import { checkCredentials, listModels } from "./models";

/**
 * OpenRouter — aggregates many upstream models behind an OpenAI-compatible
 * API. Uses OpenAI's SDK for inference but its own REST endpoints for
 * `checkProvider` and `getProviderModels` (OpenRouter's error shapes and
 * `/models/user` route aren't exposed through the SDK).
 */
class OpenRouterProvider extends OpenAIProvider {
  static override getName(): string {
    return openrouterInfo.name;
  }

  static override getBaseUrl(): string {
    return openrouterInfo.baseUrl;
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

export { OpenRouterProvider };
