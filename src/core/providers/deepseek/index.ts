import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { deepseekInfo } from "./info";
import { listModels } from "./models";

/**
 * DeepSeek — OpenAI-compatible API. Inherits the full sendMessage /
 * sendMessageSync pipeline from {@link OpenAIProvider}; overrides static
 * identity, the model list and the thinking switch.
 */
class DeepSeekProvider extends OpenAIProvider {
  /**
   * DeepSeek toggles thinking through its own `thinking.type` field, and
   * the V4 models think *by default* — omitting the field leaves them
   * reasoning with the toggle off, so off is sent explicitly as
   * `"disabled"`. Its `reasoning_effort` knows only `low` / `high` /
   * `max`, so the OpenAI `"medium"` is never sent; on relies on the
   * model's default depth.
   *
   * `deepseek-reasoner` is the always-thinking alias and takes no switch.
   */
  protected override reasoningRequestFields(
    model: string,
    withReasoning?: boolean
  ): Record<string, unknown> {
    if (model.includes("reasoner")) return {};
    return { thinking: { type: withReasoning ? "enabled" : "disabled" } };
  }

  static override getName(): string {
    return deepseekInfo.name;
  }

  static override getBaseUrl(): string {
    return deepseekInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { DeepSeekProvider };
