import type Anthropic from "@anthropic-ai/sdk";
import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import {
  effectiveReasoningLevel,
  resolveReasoningLevel,
} from "../../../shared/reasoning-level";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { AbstractBaseProvider } from "../base";
import { extractErrorMessage, getErrorStatus, ProviderErrors } from "../errors";
import { createAnthropicClient } from "./client";
import { anthropicInfo } from "./info";
import { getAnthropicReasoningSupport } from "./reasoning";
import { convertMessages } from "./messages";
import { listModels } from "./models";
import {
  createErrorResponse,
  createStopResponse,
  processStream,
} from "./stream";
import { resolveThinkingParam, THINKING_MAX_TOKENS } from "./thinking";
import { convertTools } from "./tools";

class AnthropicProvider extends AbstractBaseProvider {
  protected client: Anthropic;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createAnthropicClient(creds);
  }

  async *sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, signal } = args;
    const level = effectiveReasoningLevel(
      resolveReasoningLevel(args),
      getAnthropicReasoningSupport(model)
    );

    try {
      const convertedTools = convertTools(tools ?? []);

      const stream = await this.client.messages.create(
        {
          messages: convertMessages(messages),
          model,
          system: systemPrompt,
          tools: convertedTools.length > 0 ? convertedTools : undefined,
          stream: true,
          max_tokens: level !== "off" ? THINKING_MAX_TOKENS : 30000,
          ...(convertedTools.length > 0 && {
            tool_choice: { disable_parallel_tool_use: true, type: "auto" },
          }),
          ...resolveThinkingParam(model, level),
        },
        { signal }
      );

      yield* processStream(stream);
    } catch (error) {
      if (isAbortError(error, signal)) {
        yield { isEnd: true, responseMessage: createStopResponse() };
        return;
      }
      logger.error("Anthropic sendMessage error:", error);
      yield { isEnd: true, responseMessage: createErrorResponse(error) };
    }
  }

  async sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    const { messages, model, systemPrompt, signal } = args;
    const level = effectiveReasoningLevel(
      resolveReasoningLevel(args),
      getAnthropicReasoningSupport(model)
    );
    const response = await this.client.messages.create(
      {
        model,
        system: systemPrompt,
        messages: convertMessages(messages),
        // Thinking needs headroom above its own budget for the visible reply.
        max_tokens: level !== "off" ? THINKING_MAX_TOKENS : 4096,
        stream: false,
        ...resolveThinkingParam(model, level),
      },
      { signal }
    );
    return response.content
      .filter(
        (c): c is Extract<typeof c, { type: "text" }> => c.type === "text"
      )
      .map((c) => c.text)
      .join("");
  }

  static getName(): string {
    return anthropicInfo.name;
  }

  static getBaseUrl(): string {
    return anthropicInfo.baseUrl;
  }

  static async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    const client = createAnthropicClient(creds);
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

  static async getProviderModels(creds: ProviderCredentials): Promise<Model[]> {
    return listModels(creds);
  }
}

export { AnthropicProvider };
