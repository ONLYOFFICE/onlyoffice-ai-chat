import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { onlyOfficeInfo } from "./info";
import { listModels } from "./models";

/**
 * ONLYOFFICE AI provider — a thin OpenAI-compatible provider for the
 * host's AI route. Like {@link OpenAICompatibleProvider}, it speaks the
 * plain OpenAI wire format with no custom transport or capability
 * heuristics; the caller sees everything the endpoint exposes.
 */
class OnlyOfficeProvider extends OpenAIProvider {
  /**
   * Mid-conversation `system` messages are downgraded to `user`, matching
   * the generic OpenAI-compatible provider's safer wire format.
   */
  protected override downgradeSystem = true;

  static override getName(): string {
    return onlyOfficeInfo.name;
  }

  static override getBaseUrl(): string {
    return onlyOfficeInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { OnlyOfficeProvider };
