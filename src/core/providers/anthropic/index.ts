import type Anthropic from "@anthropic-ai/sdk";
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
import { createAnthropicClient } from "./client";
import { anthropicInfo } from "./info";
import { convertMessages } from "./messages";
import { listModels } from "./models";
import {
  createErrorResponse,
  createStopResponse,
  processStream,
} from "./stream";
import { convertTools } from "./tools";

/**
 * Output caps. Extended thinking consumes `max_tokens` (the thinking
 * budget is carved out of it), so a thinking request needs MORE headroom
 * than a plain one — not less. 32000 is the smallest max-output limit
 * among thinking-capable Claude models (Opus 4/4.1); the Sonnet and
 * Haiku 4.x families allow 64k, so this value is safe everywhere while
 * leaving 22k tokens for the visible reply.
 */
const THINKING_MAX_TOKENS = 32000;
const THINKING_BUDGET_TOKENS = 10000;

class AnthropicProvider extends AbstractBaseProvider {
  protected client: Anthropic;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createAnthropicClient(creds);
  }

  async *sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, withReasoning, signal } =
      args;

    try {
      const convertedTools = convertTools(tools ?? []);

      const stream = await this.client.messages.create(
        {
          messages: convertMessages(messages),
          model,
          system: systemPrompt,
          tools: convertedTools.length > 0 ? convertedTools : undefined,
          stream: true,
          max_tokens: withReasoning ? THINKING_MAX_TOKENS : 30000,
          ...(convertedTools.length > 0 && {
            tool_choice: { disable_parallel_tool_use: true, type: "auto" },
          }),
          ...(withReasoning && {
            thinking: {
              type: "enabled",
              budget_tokens: THINKING_BUDGET_TOKENS,
            },
          }),
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
    const { messages, model, systemPrompt, withReasoning, signal } = args;
    const response = await this.client.messages.create(
      {
        model,
        system: systemPrompt,
        messages: convertMessages(messages),
        // Thinking needs headroom above its own budget for the visible reply.
        max_tokens: withReasoning ? THINKING_MAX_TOKENS : 4096,
        stream: false,
        ...(withReasoning && {
          thinking: {
            type: "enabled",
            budget_tokens: THINKING_BUDGET_TOKENS,
          },
        }),
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
