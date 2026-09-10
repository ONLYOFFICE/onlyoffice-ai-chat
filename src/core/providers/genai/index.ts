import type { GoogleGenAI } from "@google/genai";
import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { resolveReasoningLevel } from "../../../shared/reasoning-level";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { AbstractBaseProvider } from "../base";
import { ProviderErrors } from "../errors";
import { createGenAIClient } from "./client";
import { genaiInfo } from "./info";
import { convertMessages } from "./messages";
import { listModels } from "./models";
import {
  createErrorResponse,
  createStopResponse,
  processStream,
} from "./stream";
import { getGenAIReasoningSupport } from "./reasoning";
import { resolveThinkingConfig } from "./thinking";
import { convertTools } from "./tools";

class GenAIProvider extends AbstractBaseProvider {
  protected client: GoogleGenAI;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createGenAIClient(creds);
  }

  async *sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, signal } = args;

    try {
      const convertedTools = convertTools(tools ?? []);

      const thinkingConfig = resolveThinkingConfig(
        model,
        resolveReasoningLevel(args),
        this.reasoningSupportFor(model, getGenAIReasoningSupport)
      );

      const stream = await this.client.models.generateContentStream({
        model,
        contents: convertMessages(messages),
        config: {
          systemInstruction: systemPrompt,
          tools: convertedTools.length
            ? [{ functionDeclarations: convertedTools }]
            : undefined,
          thinkingConfig,
          abortSignal: signal,
        },
      });

      yield* processStream(stream, signal);
    } catch (error) {
      if (isAbortError(error, signal)) {
        yield { isEnd: true, responseMessage: createStopResponse() };
        return;
      }
      logger.error("GenAI sendMessage error:", error);
      yield { isEnd: true, responseMessage: createErrorResponse(error) };
    }
  }

  async sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    const { messages, model, systemPrompt, signal } = args;
    const response = await this.client.models.generateContent({
      model,
      contents: convertMessages(messages),
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: resolveThinkingConfig(
          model,
          resolveReasoningLevel(args),
          this.reasoningSupportFor(model, getGenAIReasoningSupport)
        ),
        abortSignal: signal,
      },
    });
    return response.text ?? "";
  }

  static getName(): string {
    return genaiInfo.name;
  }

  static getBaseUrl(): string {
    return genaiInfo.baseUrl;
  }

  static async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    try {
      const client = createGenAIClient(creds);
      await client.models.list();
      return true;
    } catch (error) {
      if (!creds.apiKey) return ProviderErrors.emptyKey();

      const message = error instanceof Error ? error.message : "";
      const isEmptyObject =
        error !== null &&
        typeof error === "object" &&
        Object.keys(error).length === 0;

      if (isEmptyObject) return ProviderErrors.invalidUrl();
      if (message.includes("API key")) return ProviderErrors.invalidKey();

      return creds.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  }

  static async getProviderModels(creds: ProviderCredentials): Promise<Model[]> {
    return listModels(creds);
  }
}

export { GenAIProvider };
