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
  /**
   * Groq's reasoning knobs differ per model family, and the reasoning
   * models think by default:
   *
   * - Qwen 3.x: `reasoning_effort: "none"` switches reasoning off; on
   *   sends `"default"`, the one level every Qwen variant accepts (3.6
   *   knows nothing else, 3.8 adds low/medium/high).
   * - GPT-OSS: cannot stop reasoning (`low`/`medium`/`high` only). Off
   *   sends `include_reasoning: false` so the thinking at least stays out
   *   of the stream; on keeps `"medium"`.
   * - Everything else (Llama, …) has no reasoning and rejects the
   *   parameter, so nothing is sent.
   */
  protected override reasoningRequestFields(
    model: string,
    withReasoning?: boolean
  ): Record<string, unknown> {
    const id = model.toLowerCase();
    if (id.includes("qwen")) {
      return { reasoning_effort: withReasoning ? "default" : "none" };
    }
    if (id.includes("gpt-oss")) {
      return withReasoning
        ? { reasoning_effort: "medium" }
        : { include_reasoning: false };
    }
    return {};
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
