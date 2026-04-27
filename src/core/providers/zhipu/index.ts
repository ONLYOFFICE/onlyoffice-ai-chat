import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { zhipuInfo } from "./info";
import { listModels } from "./models";

/**
 * ZhiPu — GLM-4 family via an OpenAI-compatible API. Inherits the
 * chat/sync pipeline from {@link OpenAIProvider}; overrides static
 * identity and the model list (ZhiPu has its own capability heuristics
 * and a hard-coded fallback list).
 */
class ZhipuProvider extends OpenAIProvider {
  static override getName(): string {
    return zhipuInfo.name;
  }

  static override getBaseUrl(): string {
    return zhipuInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { ZhipuProvider };
