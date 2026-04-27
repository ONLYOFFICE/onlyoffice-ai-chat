import type { TErrorData } from "../../../shared/error-data";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { AbstractBaseProvider } from "../base";
import { generateImage } from "./image";
import { stabilityaiInfo } from "./info";
import { checkCredentials, listModels } from "./models";

/**
 * Stability AI provider. Image-only — chat and one-shot text throw
 * `NotSupportedError`. Use {@link imageGeneration} for requests.
 */
class StabilityAIProvider extends AbstractBaseProvider {
  constructor(creds: ProviderCredentials) {
    super(creds);
  }

  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<SendMessageResult> {
    throw new Error("Stability AI does not support chat");
  }

  async sendMessageSync(): Promise<string> {
    throw new Error("Stability AI does not support chat");
  }

  imageGeneration = (args: ImageGenerationArgs): Promise<string> =>
    generateImage(this.creds, args);

  static getName(): string {
    return stabilityaiInfo.name;
  }

  static getBaseUrl(): string {
    return stabilityaiInfo.baseUrl;
  }

  static async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    return checkCredentials(creds);
  }

  static async getProviderModels(): Promise<Model[]> {
    return listModels();
  }
}

export { StabilityAIProvider };
