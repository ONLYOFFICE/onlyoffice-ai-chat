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
import { resolveReasoningEffort } from "./reasoning";
import {
  convertMessagesToResponses,
  convertToolsToResponses,
} from "./responses-messages";
import { processResponsesStream } from "./responses-stream";
import {
  createErrorResponse,
  createStopResponse,
  processStream,
} from "./stream";
import { convertTools } from "./tools";

/**
 * Sizes accepted by OpenAI's image-generation API. Anything outside this
 * set falls back to `1024x1024` to avoid a 400 from the upstream.
 */
const OPENAI_IMAGE_SIZES = new Set([
  "256x256",
  "512x512",
  "1024x1024",
  "1792x1024",
  "1024x1792",
]);

type OpenAIImageSize =
  | "256x256"
  | "512x512"
  | "1024x1024"
  | "1792x1024"
  | "1024x1792";

class OpenAIProvider extends AbstractBaseProvider {
  protected client: OpenAI;

  /**
   * When `true`, mid-conversation `system` messages are downgraded to
   * `user`. Some OpenAI-compatible servers (LM Studio, etc.) reject
   * `system` outside the head of the request — concrete subclasses flip
   * this to opt into the safer wire format.
   */
  protected downgradeSystem = false;

  constructor(creds: ProviderCredentials) {
    super(creds);
    this.client = createOpenAIClient(creds);
  }

  async *sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult> {
    if (args.useResponsesApi) {
      yield* this.sendMessageResponses(args);
      return;
    }

    const { messages, model, systemPrompt, tools, withReasoning, signal } =
      args;

    try {
      const stream = await this.getStream({
        messages: [
          { role: "system", content: systemPrompt },
          ...convertMessages(messages, this.downgradeSystem),
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
   * Streaming path through OpenAI's Responses API (`/v1/responses`).
   * Required for gpt-5+ reasoning models which reject `reasoning_effort`
   * together with `tools` on `/v1/chat/completions`. Routed via the
   * `useResponsesApi` flag on {@link SendMessageArgs}, which the action
   * layer wires from `profile.useResponsesApi` after the live probe.
   */
  protected async *sendMessageResponses(
    args: SendMessageArgs
  ): AsyncGenerator<SendMessageResult> {
    const { messages, model, systemPrompt, tools, withReasoning, signal } =
      args;

    try {
      const input = convertMessagesToResponses(messages, this.downgradeSystem);
      const responsesTools = convertToolsToResponses(tools ?? []);
      const stream = await this.client.responses.create(
        {
          model,
          instructions: systemPrompt,
          input,
          tools: responsesTools.length > 0 ? responsesTools : undefined,
          // Force one tool call per turn. Only valid when tools are present.
          ...(responsesTools.length > 0
            ? { parallel_tool_calls: false }
            : {}),
          reasoning: ((): { effort: string } | undefined => {
            const effort = resolveReasoningEffort(model, withReasoning);
            return effort ? { effort } : undefined;
          })() as OpenAI.Reasoning | undefined,
          stream: true,
        },
        { signal }
      );

      yield* processResponsesStream(stream);
    } catch (error) {
      if (isAbortError(error, signal)) {
        yield { isEnd: true, responseMessage: createStopResponse() };
        return;
      }
      logger.error("OpenAI sendMessageResponses error:", error);
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
        // Force one tool call per turn. Only valid when tools are present.
        ...(params.tools.length > 0 ? { parallel_tool_calls: false } : {}),
        stream: true,
        reasoning_effort: resolveReasoningEffort(
          params.model,
          params.withReasoning
        ) as OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"],
      },
      { signal: params.signal }
    );
  }

  /**
   * Live probe: try a minimal non-streaming `responses.create` call. If the
   * endpoint accepts the model we route this profile through the Responses
   * API going forward; any error (404 = endpoint missing on compatible
   * backends, 400 = model unsupported there, etc.) returns `false` so the
   * profile keeps using Chat Completions.
   *
   * Subclasses targeting non-OpenAI endpoints don't override this (the
   * base class returns `false`), so the probe never hits Together / xAI /
   * etc. — only the genuine `api.openai.com` endpoint pays the cost.
   */
  async checkResponsesApi(
    modelId: string,
    signal?: AbortSignal
  ): Promise<boolean> {
    try {
      // Minimal probe — no max_output_tokens because reasoning models
      // enforce a high minimum and would 400 with a low cap.
      await this.client.responses.create(
        {
          model: modelId,
          input: ".",
          stream: false,
        },
        { signal }
      );
      return true;
    } catch (error) {
      logger.warn("OpenAI checkResponsesApi probe failed:", error);
      return false;
    }
  }

  async sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    const { messages, model, systemPrompt, useResponsesApi, signal } = args;

    if (useResponsesApi) {
      const response = await this.client.responses.create(
        {
          model,
          instructions: systemPrompt,
          input: convertMessagesToResponses(messages, this.downgradeSystem),
          stream: false,
        },
        { signal }
      );
      return response.output_text ?? "";
    }

    const response = await this.client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...convertMessages(messages, this.downgradeSystem),
        ],
        stream: false,
      },
      { signal }
    );
    return response.choices[0]?.message?.content ?? "";
  }

  async imageGeneration(args: ImageGenerationArgs): Promise<string> {
    const { model, prompt, width, height, signal } = args;
    const candidate = width && height ? `${width}x${height}` : "1024x1024";
    const size: OpenAIImageSize = OPENAI_IMAGE_SIZES.has(candidate)
      ? (candidate as OpenAIImageSize)
      : "1024x1024";

    // `gpt-image-*` models always return base64 and reject the
    // `response_format` parameter ("400 Unknown parameter: 'response_format'").
    // `dall-e-*` models default to returning a URL, so they still need
    // `response_format: "b64_json"` to get inline base64.
    const isGptImage = model.includes("gpt-image");

    try {
      const response = await this.client.images.generate(
        {
          model,
          prompt,
          n: 1,
          size,
          ...(isGptImage ? {} : { response_format: "b64_json" }),
        },
        { signal }
      );
      return response.data?.[0]?.b64_json ?? "";
    } catch (error) {
      if (isAbortError(error, signal)) return "";
      logger.error("OpenAI imageGeneration error:", error);
      throw error;
    }
  }

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

  static async getProviderModels(creds: ProviderCredentials): Promise<Model[]> {
    return listModels(creds);
  }
}

export { OpenAIProvider };
