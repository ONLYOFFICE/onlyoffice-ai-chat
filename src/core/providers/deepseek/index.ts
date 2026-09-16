import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { ReasoningLevel } from "../../../shared/reasoning-level";
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
   * DeepSeek's thinking mode checks that every assistant message of a
   * request carrying `tools` has a `reasoning_content` field — even an
   * empty one — and answers a missing field with a 400 (Bug 83335).
   */
  protected override reasoningContentMode = "always" as const;

  /**
   * DeepSeek toggles thinking through its own `thinking.type` field, and
   * the V4 models think *by default* — omitting the field leaves them
   * reasoning with the toggle off, so off is sent explicitly as
   * `"disabled"`. Its `reasoning_effort` knows only `low` / `high` /
   * `max`: those three go through, while `medium` sends no effort and
   * relies on the model's default depth (there is no `"medium"` to send).
   *
   * `deepseek-reasoner` is the always-thinking alias and takes no switch;
   * the effort levels are documented for `deepseek-v4-flash` / `-pro` only,
   * so it gets no depth either.
   */
  protected override reasoningRequestFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    const effort =
      level === "low" || level === "high" || level === "max"
        ? { reasoning_effort: level }
        : {};
    if (model.includes("reasoner")) return {};
    return {
      thinking: { type: level === "off" ? "disabled" : "enabled" },
      ...effort,
    };
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
