import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { OpenAIProvider } from "../openai";
import { openrouterInfo } from "./info";
import { checkCredentials, listModels } from "./models";

/**
 * OpenRouter — aggregates many upstream models behind an OpenAI-compatible
 * API. Uses OpenAI's SDK for inference but its own REST endpoints for
 * `checkProvider` and `getProviderModels` (OpenRouter's error shapes and
 * `/models/user` route aren't exposed through the SDK).
 */
class OpenRouterProvider extends OpenAIProvider {
  static override getName(): string {
    return openrouterInfo.name;
  }

  static override getBaseUrl(): string {
    return openrouterInfo.baseUrl;
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

  /**
   * OpenRouter takes extended thinking through its own unified `reasoning`
   * object, not OpenAI's `reasoning_effort`. That matters most for the
   * Anthropic route: Claude reasons only when this field asks it to (the
   * `:thinking` model variants are gone), so a Sonnet round sent with
   * `reasoning_effort` came back with no thinking at all.
   *
   * Reasoning off simply omits the field — `reasoning.effort` has no "none"
   * level, and every model here defaults to not thinking.
   */
  protected override reasoningRequestFields(
    _model: string,
    withReasoning?: boolean
  ): Record<string, unknown> {
    return withReasoning ? { reasoning: { effort: "medium" } } : {};
  }

  /**
   * OpenRouter does not expose `/images/generations` — image-capable
   * models (e.g. `openai/gpt-4o-image`, `gpt-5-image`) return inline
   * images via `/chat/completions` when `modalities: ["image", "text"]`
   * is set. The base64 payload arrives as a data-URI inside
   * `message.images[*].image_url.url`; strip the prefix and return raw
   * base64 to match the contract used by every other provider.
   */
  override async imageGeneration(args: ImageGenerationArgs): Promise<string> {
    const { model, prompt, signal } = args;
    logger.info("[OpenRouter.imageGeneration] called", { model, prompt });
    const t0 = performance.now();
    try {
      logger.info("[OpenRouter.imageGeneration] sending request…");
      const response = await this.client.chat.completions.create(
        {
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        } as unknown as Parameters<
          typeof this.client.chat.completions.create
        >[0],
        { signal }
      );
      logger.info(
        `[OpenRouter.imageGeneration] response received in ${(performance.now() - t0).toFixed(0)} ms`
      );

      type ChatImage = { image_url?: { url?: string } };
      const raw = response as unknown as {
        choices?: Array<{ message?: { images?: ChatImage[]; content?: unknown } }>;
      };
      logger.info("[OpenRouter.imageGeneration] raw response", {
        choicesCount: raw.choices?.length,
        firstMessageKeys: raw.choices?.[0]?.message
          ? Object.keys(raw.choices[0].message)
          : [],
        imagesCount: raw.choices?.[0]?.message?.images?.length,
        firstImageKeys: raw.choices?.[0]?.message?.images?.[0]
          ? Object.keys(raw.choices[0].message.images[0])
          : [],
        urlPrefix: raw.choices?.[0]?.message?.images?.[0]?.image_url?.url?.slice(0, 80),
      });

      const message = raw.choices?.[0]?.message;
      const url = message?.images?.[0]?.image_url?.url ?? "";
      const comma = url.indexOf(",");
      const result =
        url.startsWith("data:") && comma !== -1 ? url.slice(comma + 1) : url;
      logger.info("[OpenRouter.imageGeneration] parsed", {
        urlLength: url.length,
        resultLength: result.length,
      });
      return result;
    } catch (error) {
      logger.error(
        `[OpenRouter.imageGeneration] error after ${(performance.now() - t0).toFixed(0)} ms`,
        error
      );
      if (isAbortError(error, signal)) return "";
      throw error;
    }
  }
}

export { OpenRouterProvider };
