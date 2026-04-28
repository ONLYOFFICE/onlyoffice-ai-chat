import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

/**
 * Produce a unique fallback tool-call identifier when the SDK chunk
 * arrives without one. Uses `crypto.randomUUID()` to avoid collisions
 * when multiple tool-calls are generated within the same millisecond.
 */
const generateFallbackToolCallId = (): string => crypto.randomUUID();

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

  return content.map((part): ChatCompletionContentPart => {
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
      return {
        type: "image_url",
        image_url: { url: part.image },
      };
    }

    return { type: "text", text: "" };
  });
};

/** Intermediate shape used when translating an assistant message. */
interface ProcessedAssistantParts {
  content: ChatCompletionAssistantMessageParam["content"];
  reasoningContent: string | null;
  toolCalls: ChatCompletionMessageFunctionToolCall[];
  toolResults: ChatCompletionToolMessageParam[];
}

/**
 * Split a single assistant `ThreadMessageLike` into OpenAI wire-format
 * pieces: the assistant message body, accompanying `tool_calls`, and
 * subsequent `tool` messages carrying their results. Reasoning parts are
 * captured separately — OpenAI carries them through a non-standard
 * `reasoning_content` field on the assistant message.
 *
 * @param message - One assistant message from the thread.
 * @returns The split-out content / tool_calls / tool_results / reasoning.
 */
const processAssistantParts = (
  message: ThreadMessageLike
): ProcessedAssistantParts => {
  if (typeof message.content === "string") {
    return {
      content: message.content,
      reasoningContent: null,
      toolCalls: [],
      toolResults: [],
    };
  }

  const content: ChatCompletionAssistantMessageParam["content"] = [];
  const toolCalls: ChatCompletionMessageFunctionToolCall[] = [];
  const toolResults: ChatCompletionToolMessageParam[] = [];
  let reasoningContent: string | null = null;

  for (const part of message.content) {
    if (part.type === "text") {
      content.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "reasoning") {
      reasoningContent = part.text;
      continue;
    }

    if (part.type !== "tool-call") continue;

    if (part.result) {
      toolResults.push({
        role: "tool",
        content: part.result,
        tool_call_id: part.toolCallId ?? generateFallbackToolCallId(),
      });
    }

    toolCalls.push({
      id: part.toolCallId ?? generateFallbackToolCallId(),
      type: "function",
      function: {
        arguments: part.argsText ?? "",
        name: part.toolName,
      },
    });
  }

  return { content, reasoningContent, toolCalls, toolResults };
};

/** Assistant message with optional DeepSeek/thinking `reasoning_content`. */
type AssistantMessageWithReasoning = ChatCompletionAssistantMessageParam & {
  reasoning_content?: string;
};

/**
 * Convert the thread's message array into OpenAI's wire format.
 *
 * Assistant turns may expand into multiple messages: one assistant message
 * followed by one or more `tool` messages when tool-results are attached.
 *
 * @param messages - The thread as a flat array of `ThreadMessageLike`.
 * @param downgradeSystem - When `true`, mid-conversation `system` messages
 *   are converted to `user` (some OpenAI-compatible servers reject `system`
 *   anywhere but the head of the request). Defaults to `false`.
 * @returns A flat array ready to pass to `chat.completions.create`.
 */
export const convertMessages = (
  messages: ThreadMessageLike[],
  downgradeSystem = false
): ChatCompletionMessageParam[] => {
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

    const { content, reasoningContent, toolCalls, toolResults } =
      processAssistantParts(message);

    const assistantMessage: AssistantMessageWithReasoning = {
      role: "assistant",
      content,
    };

    if (reasoningContent) {
      assistantMessage.reasoning_content = reasoningContent;
    }

    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls;
    }

    result.push(assistantMessage);

    if (toolResults.length > 0) {
      result.push(...toolResults);
    }
  }

  return result;
};
