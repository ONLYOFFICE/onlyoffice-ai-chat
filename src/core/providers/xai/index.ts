import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import {
  effectiveReasoningLevel,
  type ReasoningLevel,
} from "../../../shared/reasoning-level";
import { OpenAIProvider } from "../openai";
import { xaiInfo } from "./info";
import { listModels } from "./models";
import { getXAIReasoningSupport } from "./reasoning";

/**
 * xAI (Grok) — OpenAI-compatible API. Inherits the chat/sync pipeline
 * from {@link OpenAIProvider}; overrides static identity and the model
 * list (Grok has its own capability heuristics).
 */
class XAIProvider extends OpenAIProvider {
  /**
   * `reasoning_effort` only where xAI documents it — the level is clamped
   * to {@link getXAIReasoningSupport}, so grok-3-mini gets `low` / `high`,
   * grok-4.5 `low` … `high`, grok-4.6+ up to `xhigh`, and the models that
   * reject the parameter (grok-4, 4.1-fast, code-fast) get nothing; the
   * inherited `"medium"` used to 400 there. Grok's reasoning cannot be
   * disabled, so a stored off means the standard depth, `"medium"` (`"high"`
   * on grok-3-mini, which has no medium).
   */
  protected override reasoningRequestFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    const support = getXAIReasoningSupport(model);
    if (support.depths.length === 0) return {};
    const effective = effectiveReasoningLevel(level, support);
    if (effective === "off") return {};
    return { reasoning_effort: effective === "max" ? "xhigh" : effective };
  }

  static override getName(): string {
    return xaiInfo.name;
  }

  static override getBaseUrl(): string {
    return xaiInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { XAIProvider };
