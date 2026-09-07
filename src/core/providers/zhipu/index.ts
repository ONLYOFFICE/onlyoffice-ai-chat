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
  /**
   * GLM-4.5 and newer think *by default* and are switched through
   * Zhipu's own `thinking.type` field (`reasoning_effort` means nothing
   * here), so off has to be sent explicitly as `"disabled"`. Older GLM-4
   * models have no thinking and get no field at all.
   */
  protected override reasoningRequestFields(
    model: string,
    withReasoning?: boolean
  ): Record<string, unknown> {
    if (!/glm-(?:4\.[5-9]|[5-9])/i.test(model)) return {};
    return { thinking: { type: withReasoning ? "enabled" : "disabled" } };
  }

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
