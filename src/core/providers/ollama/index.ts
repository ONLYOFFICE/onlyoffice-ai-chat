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
  /**
   * Ollama's OpenAI-compatible shim doesn't fill `reasoning_content` — the
   * models it serves emit their thinking inside `content` (`<think>` on
   * Qwen3 and the R1 distills, harmony channels on gpt-oss), so it has to
   * be split out here or it becomes the answer.
   */
  protected override splitInlineReasoning = true;

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
