import type Anthropic from "@anthropic-ai/sdk";
import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import {
  effectiveReasoningLevel,
  resolveReasoningLevel,
  type ReasoningLevel,
  type ReasoningSupport,
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
import {
  isBetweenToolsRejection,
  rememberBetweenToolsOff,
  resolveThinkingParam,
  sendsDisabledThinking,
  THINKING_MAX_TOKENS,
} from "./thinking";
import { convertTools } from "./tools";

/**
 * Run one `messages.create` built from the thinking fields of `model`.
 * A model that answers `thinking: disabled` with the 400 naming
 * `between_tools` is retried once with that spelling and remembered, so a
 * model the per-model table doesn't know yet (Sonnet 5 did this before
 * the docs said so) keeps working instead of failing every round — and
 * the capability probe, which runs with thinking off, doesn't stick the
 * profile with a false `canUseTool: false`.
 */
async function createWithThinking<T>(
  model: string,
  level: ReasoningLevel,
  support: ReasoningSupport,
  create: (thinking: ReturnType<typeof resolveThinkingParam>) => Promise<T>
): Promise<T> {
  const first = resolveThinkingParam(model, level, support);
  try {
    return await create(first);
  } catch (error) {
    if (!sendsDisabledThinking(first) || !isBetweenToolsRejection(error)) {
      throw error;
    }
    logger.warn(
      `Anthropic: ${model} rejects thinking: disabled, retrying with between_tools`
    );
    rememberBetweenToolsOff(model);
    return create(resolveThinkingParam(model, level, support));
  }
}

class AnthropicProvider extends AbstractBaseProvider {
  protected client: Anthropic;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createAnthropicClient(creds);
  }

  async *sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, signal } = args;
    const support = this.reasoningSupportFor(
      model,
      getAnthropicReasoningSupport
    );
    const level = effectiveReasoningLevel(resolveReasoningLevel(args), support);

    try {
      const convertedTools = convertTools(tools ?? []);

      const stream = await createWithThinking(
        model,
        level,
        support,
        (thinking) =>
          this.client.messages.create(
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
              ...thinking,
            },
            { signal }
          )
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
    const support = this.reasoningSupportFor(
      model,
      getAnthropicReasoningSupport
    );
    const level = effectiveReasoningLevel(resolveReasoningLevel(args), support);
    const response = await createWithThinking(
      model,
      level,
      support,
      (thinking) =>
        this.client.messages.create(
          {
            model,
            system: systemPrompt,
            messages: convertMessages(messages),
            // Thinking needs headroom above its own budget for the visible reply.
            max_tokens: level !== "off" ? THINKING_MAX_TOKENS : 4096,
            stream: false,
            ...thinking,
          },
          { signal }
        )
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
