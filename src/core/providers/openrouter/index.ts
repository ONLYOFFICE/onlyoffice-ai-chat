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
    try {
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

      type ChatImage = { image_url?: { url?: string } };
      const message = (
        response as unknown as {
          choices?: Array<{ message?: { images?: ChatImage[] } }>;
        }
      ).choices?.[0]?.message;
      const url = message?.images?.[0]?.image_url?.url ?? "";
      const comma = url.indexOf(",");
      return url.startsWith("data:") && comma !== -1
        ? url.slice(comma + 1)
        : url;
    } catch (error) {
      if (isAbortError(error, signal)) return "";
      logger.error("OpenRouter imageGeneration error:", error);
      throw error;
    }
  }
}

export { OpenRouterProvider };
