import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { groqInfo } from "./info";
import { listModels } from "./models";

/**
 * Groq — OpenAI-compatible inference API. Inherits the chat/sync
 * pipeline from {@link OpenAIProvider}; overrides static identity and
 * the model list (Groq excludes Whisper and flags vision-capable models).
 */
class GroqProvider extends OpenAIProvider {
  static override getName(): string {
    return groqInfo.name;
  }

  static override getBaseUrl(): string {
    return groqInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { GroqProvider };
