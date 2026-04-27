import type OpenAI from "openai";
import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { AbstractBaseProvider } from "../base";
import { getErrorCode, ProviderErrors } from "../errors";
import { createOpenAIClient } from "./client";
import { openaiInfo } from "./info";
import { convertMessages } from "./messages";
import { listModels } from "./models";
import {
  createErrorResponse,
  createStopResponse,
  processStream,
} from "./stream";
import { convertTools } from "./tools";

class OpenAIProvider extends AbstractBaseProvider {
  protected client: OpenAI;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createOpenAIClient(creds);
  }

  async *sendMessage(
    args: SendMessageArgs
  ): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, withReasoning, signal } =
      args;

    try {
      const stream = await this.getStream({
        messages: [
          { role: "system", content: systemPrompt },
          ...convertMessages(messages),
        ],
        model,
        tools: convertTools(tools ?? []),
        withReasoning,
        signal,
      });

      yield* processStream(stream);
    } catch (error) {
      if (isAbortError(error, signal)) {
        yield { isEnd: true, responseMessage: createStopResponse() };
        return;
      }
      logger.error("OpenAI sendMessage error:", error);
      yield { isEnd: true, responseMessage: createErrorResponse(error) };
    }
  }

  /**
   * Build the underlying streaming request. Isolated so subclasses
   * (e.g. ONLYOFFICE with raw fetch / SSE) can override transport details
   * while reusing the rest of `sendMessage`.
   */
  protected async getStream(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    model: string;
    tools: OpenAI.Chat.ChatCompletionTool[];
    withReasoning?: boolean;
    signal?: AbortSignal;
  }) {
    return this.client.chat.completions.create(
      {
        messages: params.messages,
        model: params.model,
        tools: params.tools.length > 0 ? params.tools : undefined,
        stream: true,
        reasoning_effort: params.withReasoning ? "medium" : undefined,
      },
      { signal: params.signal }
    );
  }

  async sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    const { messages, model, systemPrompt, signal } = args;
    try {
      const response = await this.client.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...convertMessages(messages),
          ],
          stream: false,
        },
        { signal }
      );
      return response.choices[0]?.message?.content ?? "";
    } catch (e) {
      logger.error("OpenAI sendMessageSync error:", e);
      return "";
    }
  }

  imageGeneration = async (args: ImageGenerationArgs): Promise<string> => {
    const { model, prompt, width, height, signal } = args;
    const size =
      width && height
        ? (`${width}x${height}` as
            | "256x256"
            | "512x512"
            | "1024x1024"
            | "1792x1024"
            | "1024x1792")
        : "1024x1024";

    const response = await this.client.images.generate(
      {
        model,
        prompt,
        n: 1,
        size,
        response_format: "b64_json",
      },
      { signal }
    );

    return response.data?.[0]?.b64_json ?? "";
  };

  static getName(): string {
    return openaiInfo.name;
  }

  static getBaseUrl(): string {
    return openaiInfo.baseUrl;
  }

  static async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    const client = createOpenAIClient(creds);
    try {
      await client.models.list();
      return true;
    } catch (error) {
      const errorCode = getErrorCode(error);
      if (errorCode === "invalid_api_key") return ProviderErrors.invalidKey();
      if (errorCode === 404) return ProviderErrors.invalidUrl();
      return creds.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  }

  static async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { OpenAIProvider };
