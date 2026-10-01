import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { parseGuardedImageDataUrl } from "../../../shared/image-data-url";
import { splitToolResultImages } from "../../../shared/mcp-result";

/**
 * Produce a unique fallback tool-call identifier when the SDK chunk
 * arrives without one. Uses `crypto.randomUUID()` to avoid collisions
 * when multiple tool-calls are generated within the same millisecond.
 */
const generateFallbackToolCallId = (): string => crypto.randomUUID();

/**
 * Collapse a text-only content-part array into a plain string.
 *
 * The OpenAI schema accepts `content` as either a string or an array of
 * parts, but not every OpenAI-compatible upstream does: Cloudflare Workers
 * AI (reachable through OpenRouter) rejects an array outright with
 * `Type mismatch of '/messages/N/content', 'string' not in 'array'`.
 * Sending a string whenever there is nothing multimodal to express keeps
 * those backends working without changing what the model receives.
 *
 * Arrays holding an image (or any non-text part) are left untouched — there
 * is no lossless string form for them.
 *
 * @param parts - Already-converted OpenAI content parts.
 * @returns The joined text, or the original array when it isn't text-only.
 */
const flattenTextParts = <T extends { type: string }>(
  parts: T[]
): string | T[] => {
  if (!parts.every((part) => part.type === "text")) return parts;
  return parts
    .map((part) => (part as unknown as { text: string }).text)
    .join("\n");
};

/**
 * Convert a user-message `content` payload into OpenAI's chat-completion
 * content parts.
 *
 * Handles:
 *  - plain strings (passed through)
 *  - text parts
 *  - image parts (mapped to `image_url`)
 *  - file parts (serialized into a text part carrying filename + data URL)
 *
 * Unknown part kinds collapse into an empty text part.
 *
 * @param content - The `ThreadMessageLike.content` for a user message.
 * @returns A string or an array of OpenAI content parts.
 */
const convertUserContent = (
  content: ThreadMessageLike["content"]
): string | ChatCompletionContentPart[] => {
  if (typeof content === "string") return content;

  const parts = content.map((part): ChatCompletionContentPart => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }

    if (part.type === "file") {
      const meta = JSON.parse(part.mimeType);
      return {
        type: "text",
        text: JSON.stringify({
          file_data: part.data,
          filename: meta.path,
          file_id: meta.path,
        }),
      };
    }

    if (part.type === "image") {
      // Only forward inlined base64 data URLs. A leftover ref or an
      // http(s) URL would be sent as `image_url.url` verbatim, which the
      // model can't fetch — drop it to an empty text part instead.
      if (!parseGuardedImageDataUrl(part.image)) {
        return { type: "text", text: "" };
      }
      return {
        type: "image_url",
        // Explicit `detail` on every attached image: without it some
        // OpenAI-compatible backends fall back to processing the
        // original-size image. "high" caps the input at the tiled
        // high-detail pipeline (longest side 2048px) while keeping
        // small text readable.
        image_url: { url: part.image, detail: "high" },
      };
    }

    return { type: "text", text: "" };
  });

  return flattenTextParts(parts);
};

/**
 * One round of an assistant turn in OpenAI terms: the assistant message
 * body (text + `tool_calls` + optional reasoning) and the `tool` messages
 * that answer its calls.
 */
interface AssistantRound {
  content: ChatCompletionContentPartText[];
  reasoning: string[];
  toolCalls: ChatCompletionMessageFunctionToolCall[];
  toolResults: ChatCompletionToolMessageParam[];
  /**
   * Images the round's tools returned. A `tool` message's `content` is
   * text-only in Chat Completions, so they travel in a `user` message
   * that follows the tool results — see {@link buildToolImagesMessage}.
   */
  toolImages: ChatCompletionContentPart[];
}

const createRound = (): AssistantRound => ({
  content: [],
  reasoning: [],
  toolCalls: [],
  toolResults: [],
  toolImages: [],
});

/**
 * Wrap the images a round's tools returned into one `user` message:
 * a short label naming the tool, then an `image_url` part per picture.
 * Chat Completions has no image channel on the `tool` role, and a user
 * turn placed right after the tool results is how the model gets to see
 * a screenshot or a rendered chart a tool produced.
 */
const buildToolImagesMessage = (
  parts: ChatCompletionContentPart[]
): ChatCompletionMessageParam => ({
  role: "user",
  content: parts,
});

/**
 * Split a single assistant `ThreadMessageLike` into the rounds it went
 * through on the wire.
 *
 * The engine resumes a chat after a tool result *into the same* assistant
 * message, so one stored message holds every round of a tool loop:
 * `[reasoning, tool-call+result, reasoning, tool-call+result, text]`.
 * Flattening that into one assistant message with all `tool_calls` loses
 * every reasoning block but the last and places the final text before the
 * tool results it was written from. DeepSeek's thinking mode rejects such
 * a history outright — every round must come back with its own
 * `reasoning_content` (Bug 83335) — and for every other backend the
 * per-round form is simply what the model produced.
 *
 * A round ends once it holds a tool call and a non-tool part follows:
 * that part was streamed *after* the tool result, i.e. by the next
 * request. Consecutive tool calls stay in one round — the model may have
 * issued them in parallel, and the wire shape is valid either way.
 *
 * @param message - One assistant message from the thread.
 * @returns The rounds, in order; a message with no parts yields one empty
 *   round so the turn still appears in the history.
 */
const splitAssistantRounds = (
  message: ThreadMessageLike & {
    content: Exclude<ThreadMessageLike["content"], string>;
  }
): AssistantRound[] => {
  const rounds: AssistantRound[] = [];
  let round = createRound();

  for (const part of message.content) {
    if (part.type !== "tool-call" && round.toolCalls.length > 0) {
      rounds.push(round);
      round = createRound();
    }

    if (part.type === "text") {
      round.content.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "reasoning") {
      round.reasoning.push(part.text);
      continue;
    }

    if (part.type !== "tool-call") continue;

    const toolCallId = part.toolCallId ?? generateFallbackToolCallId();

    if (part.result) {
      const raw =
        typeof part.result === "string"
          ? part.result
          : JSON.stringify(part.result);
      const { text, images } = splitToolResultImages(raw);
      round.toolResults.push({
        role: "tool",
        content: text,
        tool_call_id: toolCallId,
      });
      if (images.length > 0) {
        round.toolImages.push(
          {
            type: "text",
            text: `Image(s) returned by the tool "${part.toolName}":`,
          },
          ...images.map(
            (img): ChatCompletionContentPart => ({
              type: "image_url",
              image_url: { url: img.dataUrl, detail: "high" },
            })
          )
        );
      }
    }

    round.toolCalls.push({
      id: toolCallId,
      type: "function",
      function: {
        arguments: part.argsText ?? "",
        name: part.toolName,
      },
    });
  }

  rounds.push(round);
  return rounds;
};

/** Assistant message with optional DeepSeek/thinking `reasoning_content`. */
type AssistantMessageWithReasoning = ChatCompletionAssistantMessageParam & {
  reasoning_content?: string;
};

/**
 * How `reasoning_content` is replayed on assistant messages.
 *
 * - `"when-present"` — sent only when the message carries a reasoning
 *   part. The default: the field is non-standard, and most backends only
 *   read it when they wrote it.
 * - `"always"` — sent on every assistant message, `""` when there is no
 *   reasoning. DeepSeek's thinking mode requires the field on every
 *   assistant message of a request that carries `tools` and answers a
 *   missing one with `400 The reasoning_content in the thinking mode must
 *   be passed back to the API` — a round the model answered without
 *   thinking, or a turn produced with thinking off, would otherwise poison
 *   the whole thread (Bug 83335).
 */
export type ReasoningContentMode = "when-present" | "always";

/** Options for {@link convertMessages}. */
export interface ConvertMessagesOptions {
  /**
   * When `true`, mid-conversation `system` messages are converted to
   * `user` (some OpenAI-compatible servers reject `system` anywhere but
   * the head of the request). Defaults to `false`.
   */
  downgradeSystem?: boolean;
  /** See {@link ReasoningContentMode}. Defaults to `"when-present"`. */
  reasoningContent?: ReasoningContentMode;
}

/**
 * Convert the thread's message array into OpenAI's wire format.
 *
 * Assistant turns may expand into multiple messages: one assistant message
 * per tool-call round, each followed by the `tool` messages carrying its
 * results — see {@link splitAssistantRounds}.
 *
 * @param messages - The thread as a flat array of `ThreadMessageLike`.
 * @param options - See {@link ConvertMessagesOptions}. A bare boolean is
 *   accepted as `downgradeSystem` for the older call shape.
 * @returns A flat array ready to pass to `chat.completions.create`.
 */
export const convertMessages = (
  messages: ThreadMessageLike[],
  options: ConvertMessagesOptions | boolean = {}
): ChatCompletionMessageParam[] => {
  const { downgradeSystem = false, reasoningContent = "when-present" } =
    typeof options === "boolean" ? { downgradeSystem: options } : options;
  const result: ChatCompletionMessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user" || message.role === "system") {
      const role =
        message.role === "system" && downgradeSystem ? "user" : message.role;
      result.push({
        role,
        content: convertUserContent(message.content),
      } as ChatCompletionMessageParam);
      continue;
    }

    if (typeof message.content === "string") {
      const assistantMessage: AssistantMessageWithReasoning = {
        role: "assistant",
        content: message.content,
      };
      if (reasoningContent === "always") {
        assistantMessage.reasoning_content = "";
      }
      result.push(assistantMessage);
      continue;
    }

    for (const round of splitAssistantRounds(
      message as ThreadMessageLike & {
        content: Exclude<ThreadMessageLike["content"], string>;
      }
    )) {
      const assistantMessage: AssistantMessageWithReasoning = {
        role: "assistant",
        content: flattenTextParts(round.content),
      };

      const reasoning = round.reasoning.join("\n");
      if (reasoning || reasoningContent === "always") {
        assistantMessage.reasoning_content = reasoning;
      }

      if (round.toolCalls.length > 0) {
        assistantMessage.tool_calls = round.toolCalls;
      }

      result.push(assistantMessage);

      if (round.toolResults.length > 0) {
        result.push(...round.toolResults);
      }
      if (round.toolImages.length > 0) {
        result.push(buildToolImagesMessage(round.toolImages));
      }
    }
  }

  return result;
};
