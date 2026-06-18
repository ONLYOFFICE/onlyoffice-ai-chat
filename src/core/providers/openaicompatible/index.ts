import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { openaicompatibleInfo } from "./info";
import { listModels } from "./models";

/**
 * Generic OpenAI-compatible provider — for any third-party or
 * self-hosted API that speaks the OpenAI wire format. No model
 * filtering, no capability heuristics; the caller sees everything the
 * endpoint exposes.
 */
class OpenAICompatibleProvider extends OpenAIProvider {
  /**
   * Many OpenAI-compatible servers (LM Studio, llama.cpp, etc.) reject
   * mid-conversation `system` messages, so we downgrade them to `user`.
   */
  protected override downgradeSystem = true;

  static override getName(): string {
    return openaicompatibleInfo.name;
  }

  static override getBaseUrl(): string {
    return openaicompatibleInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { OpenAICompatibleProvider };
