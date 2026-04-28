import type OpenAI from "openai";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { convertMessages } from "../openai/messages";
import { OpenAIProvider } from "../openai";
import { onlyOfficeInfo } from "./info";
import {
  checkCredentials,
  listModels,
  ONLYOFFICE_PROVIDER_ID,
} from "./models";
import { openSSEStream, type SSEStreamParams } from "./stream";

/**
 * Map the user-facing ONLYOFFICE base URL to the internal OpenAI-
 * compatible route that the host exposes for AI calls.
 *
 * @example
 *   transformBaseUrl("https://example.onlyoffice.com/") →
 *   "https://example.onlyoffice.com/api/2.0/ai/openai/-1/v1"
 */
const transformBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/api/2.0/ai/openai/${ONLYOFFICE_PROVIDER_ID}/v1`;
};

/**
 * ONLYOFFICE AI provider. Reuses the OpenAI SDK for non-stream requests
 * (sync chat, images) but overrides the streaming path with a raw-fetch
 * SSE reader because the ONLYOFFICE host emits non-standard error frames
 * inside the SSE stream that the OpenAI SDK does not surface cleanly.
 */
class OnlyOfficeProvider extends OpenAIProvider {
  constructor(creds: ProviderCredentials) {
    super({ ...creds, baseUrl: transformBaseUrl(creds.baseUrl) });
  }

  static override getName(): string {
    return onlyOfficeInfo.name;
  }

  static override getBaseUrl(): string {
    return onlyOfficeInfo.baseUrl;
  }

  /**
   * Override the streaming transport: raw fetch against the ONLYOFFICE
   * OpenAI-compatible URL + manual SSE parsing via {@link openSSEStream}.
   */
  protected override async getStream(params: SSEStreamParams) {
    return openSSEStream(this.creds, params) as unknown as Awaited<
      ReturnType<OpenAIProvider["getStream"]>
    >;
  }

  override async sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    const { messages, model, systemPrompt, signal } = args;
    const response = await this.client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...convertMessages(messages),
        ] as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: false,
      },
      { signal }
    );
    return response.choices[0]?.message?.content ?? "";
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }

  static override async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    return checkCredentials(creds);
  }
}

export { OnlyOfficeProvider };
