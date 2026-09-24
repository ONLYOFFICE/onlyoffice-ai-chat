import type OpenAI from "openai";
import { isAbortError } from "../../../shared/abort";
import type { TErrorData } from "../../../shared/error-data";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import logger from "../../../shared/logger";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { ReasoningLevel } from "../../../shared/reasoning-level";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { OpenAIProvider } from "../openai";
import { openrouterInfo } from "./info";
import { checkCredentials, listModels } from "./models";
import {
  getOpenRouterReasoningSupport,
  openRouterReasoningFields,
  retryWhenReasoningMandatory,
} from "./reasoning";
import {
  openRouterModalityFields,
  openRouterRoutingFields,
} from "./routing";

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
   * Routing hints on every chat-completions request — the thread id as
   * `session_id` (sticky routing, warm KV cache across the turns of one
   * chat) and the latency / throughput preferences under `provider`. See
   * {@link openRouterRoutingFields}.
   *
   * Image-output routes additionally get `modalities`, without which
   * OpenRouter answers a chat round with reasoning and text but no
   * picture — see {@link openRouterModalityFields}.
   */
  protected override extraBody(model?: string): Record<string, unknown> {
    return {
      ...openRouterRoutingFields(this.creds.sessionId),
      ...(model ? openRouterModalityFields(model) : {}),
    };
  }

  /**
   * OpenRouter takes extended thinking through its own unified `reasoning`
   * object, not OpenAI's `reasoning_effort`. That matters most for the
   * Anthropic route: Claude reasons only as this field says (the
   * `:thinking` model variants are gone), so a Sonnet round sent with
   * `reasoning_effort` came back with no thinking at all.
   *
   * Reasoning off is sent explicitly as `effort: "none"` — OpenRouter's
   * documented "disables reasoning entirely" level. Omitting the field is
   * not enough: models OpenRouter marks as reasoning-by-default (Gemini 3,
   * …) keep thinking when nothing says otherwise. Routes that cannot stop
   * upstream get the standard depth — see {@link openRouterReasoningFields}.
   */
  /**
   * Both request shapes retry once at the standard depth when a route the
   * catalogue calls switchable answers "reasoning is mandatory" to `none` —
   * see {@link retryWhenReasoningMandatory}.
   */
  protected override getStream(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    model: string;
    tools: OpenAI.Chat.ChatCompletionTool[];
    reasoningLevel: ReasoningLevel;
    signal?: AbortSignal;
  }) {
    return retryWhenReasoningMandatory(
      {
        model: params.model,
        level: params.reasoningLevel,
        support: this.reasoningSupportFor(
          params.model,
          getOpenRouterReasoningSupport
        ),
      },
      (reasoningLevel) => super.getStream({ ...params, reasoningLevel })
    );
  }

  protected override getCompletion(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    model: string;
    reasoningLevel: ReasoningLevel;
    signal?: AbortSignal;
  }) {
    return retryWhenReasoningMandatory(
      {
        model: params.model,
        level: params.reasoningLevel,
        support: this.reasoningSupportFor(
          params.model,
          getOpenRouterReasoningSupport
        ),
      },
      (reasoningLevel) => super.getCompletion({ ...params, reasoningLevel })
    );
  }

  protected override reasoningRequestFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    return openRouterReasoningFields(
      model,
      level,
      this.reasoningSupportFor(model, getOpenRouterReasoningSupport)
    );
  }

  /**
   * OpenRouter stays on `/chat/completions`. It does answer `/v1/responses`,
   * so the inherited live probe would flip its profiles onto the Responses
   * transport — but that API documents only `minimal`…`high` for
   * `reasoning.effort`, with no off switch, whereas the chat endpoint takes
   * the full unified object (`effort: "none"`, `exclude`, `max_tokens`) and
   * streams the thinking back as `delta.reasoning`. Nothing OpenRouter serves
   * needs the Responses transport, so the probe is skipped outright…
   */
  override async checkResponsesApi(): Promise<boolean> {
    return false;
  }

  /**
   * …and profiles that were probed onto it by an earlier build are steered
   * back: `useResponsesApi` is stored on the profile and re-probed only
   * when the model, provider or base URL changes.
   */
  override sendMessage(
    args: SendMessageArgs
  ): AsyncGenerator<SendMessageResult> {
    return super.sendMessage({ ...args, useResponsesApi: false });
  }

  override sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    return super.sendMessageSync({ ...args, useResponsesApi: false });
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
    const t0 = performance.now();
    try {
      logger.info("[OpenRouter.imageGeneration] sending request…");
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
      logger.info(
        `[OpenRouter.imageGeneration] response received in ${(performance.now() - t0).toFixed(0)} ms`
      );

      type ChatImage = { image_url?: { url?: string } };
      const raw = response as unknown as {
        choices?: Array<{
          message?: { images?: ChatImage[]; content?: unknown };
        }>;
      };
      logger.info("[OpenRouter.imageGeneration] raw response", {
        choicesCount: raw.choices?.length,
        firstMessageKeys: raw.choices?.[0]?.message
          ? Object.keys(raw.choices[0].message)
          : [],
        imagesCount: raw.choices?.[0]?.message?.images?.length,
        firstImageKeys: raw.choices?.[0]?.message?.images?.[0]
          ? Object.keys(raw.choices[0].message.images[0])
          : [],
        urlPrefix:
          raw.choices?.[0]?.message?.images?.[0]?.image_url?.url?.slice(0, 80),
      });

      const message = raw.choices?.[0]?.message;
      const url = message?.images?.[0]?.image_url?.url ?? "";
      const comma = url.indexOf(",");
      const result =
        url.startsWith("data:") && comma !== -1 ? url.slice(comma + 1) : url;
      logger.info("[OpenRouter.imageGeneration] parsed", {
        urlLength: url.length,
        resultLength: result.length,
      });
      return result;
    } catch (error) {
      logger.error(
        `[OpenRouter.imageGeneration] error after ${(performance.now() - t0).toFixed(0)} ms`,
        error
      );
      if (isAbortError(error, signal)) return "";
      throw error;
    }
  }
}

export { OpenRouterProvider };
