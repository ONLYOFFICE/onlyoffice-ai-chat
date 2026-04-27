import type { Mistral } from "@mistralai/mistralai";
import type { Messages } from "@mistralai/mistralai/models/components";
import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { AbstractBaseProvider } from "../base";
import { extractErrorMessage, getErrorStatus, ProviderErrors } from "../errors";
import { createMistralClient } from "./client";
import { mistralInfo } from "./info";
import { convertMessages } from "./messages";
import { listModels, resolveReasoningModel } from "./models";
import {
  createErrorResponse,
  createStopResponse,
  processStream,
} from "./stream";
import { convertTools } from "./tools";

class MistralProvider extends AbstractBaseProvider {
  protected client: Mistral;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createMistralClient(creds);
  }

  async *sendMessage(
    args: SendMessageArgs
  ): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, withReasoning, signal } =
      args;

    try {
      const convertedTools = convertTools(tools ?? []);
      const effectiveModel = withReasoning
        ? resolveReasoningModel(model)
        : model;

      const stream = await this.client.chat.stream({
        model: effectiveModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...convertMessages(messages),
        ] as Messages[],
        tools: convertedTools.length > 0 ? convertedTools : undefined,
      });

      yield* processStream(stream, signal);
    } catch (error) {
      if (isAbortError(error, signal)) {
        yield { isEnd: true, responseMessage: createStopResponse() };
        return;
      }
      logger.error("Mistral sendMessage error:", error);
      yield { isEnd: true, responseMessage: createErrorResponse(error) };
    }
  }

  async sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    const { messages, model, systemPrompt } = args;
    try {
      const response = await this.client.chat.complete({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...convertMessages(messages),
        ] as Messages[],
      });
      const content = response.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : "";
    } catch (e) {
      logger.error("Mistral sendMessageSync error:", e);
      return "";
    }
  }

  static getName(): string {
    return mistralInfo.name;
  }

  static getBaseUrl(): string {
    return mistralInfo.baseUrl;
  }

  static async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    const client = createMistralClient(creds);
    try {
      await client.models.list();
      return true;
    } catch (error) {
      const status = getErrorStatus(error);
      if (
        status === 0 ||
        (error && typeof error === "object" && "cause" in error)
      ) {
        return ProviderErrors.invalidUrl();
      }
      if (status === 401) {
        return ProviderErrors.invalidKey(extractErrorMessage(error));
      }
      if (status === 404) return ProviderErrors.invalidUrl();
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

export { MistralProvider };
