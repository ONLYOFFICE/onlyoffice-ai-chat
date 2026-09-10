import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import {
  effectiveReasoningLevel,
  type ReasoningLevel,
} from "../../../shared/reasoning-level";
import { OpenAIProvider } from "../openai";
import { groqInfo } from "./info";
import { listModels } from "./models";
import { getGroqReasoningSupport } from "./reasoning";

/**
 * Groq — OpenAI-compatible inference API. Inherits the chat/sync
 * pipeline from {@link OpenAIProvider}; overrides static identity and
 * the model list (Groq excludes Whisper and flags vision-capable models).
 */
class GroqProvider extends OpenAIProvider {
  /**
   * Groq's reasoning knobs differ per model family, and the reasoning
   * models think by default. The level is clamped to
   * {@link getGroqReasoningSupport} first (`max` → `high`, everything →
   * `medium` on the Qwen models that know only `default`):
   *
   * - Qwen: `reasoning_effort: "none"` switches reasoning off; `medium`
   *   sends `"default"`, the one level every Qwen variant accepts.
   * - GPT-OSS: cannot stop reasoning, so a stored off is the standard depth,
   *   `"medium"`.
   * - Everything else (Llama, …) has no reasoning and rejects the
   *   parameter, so nothing is sent.
   */
  protected override reasoningRequestFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    const support = getGroqReasoningSupport(model);
    if (!support.thinks) return {};
    const id = model.toLowerCase();
    const effective = effectiveReasoningLevel(level, support);
    if (id.includes("qwen")) {
      if (effective === "off") return { reasoning_effort: "none" };
      return {
        reasoning_effort: effective === "medium" ? "default" : effective,
      };
    }
    return { reasoning_effort: effective };
  }

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
