import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  FunctionTool,
  ResponseInputContent,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type { TMCPItem } from "../../../shared/mcp-item";

/**
 * Produce a unique fallback tool-call identifier when a tool-call part
 * arrives without one. Mirrors {@link generateFallbackToolCallId} in
 * `messages.ts` — Responses API requires non-empty `call_id`s to thread
 * arguments back to their outputs.
 */
const generateFallbackCallId = (): string => crypto.randomUUID();

/**
 * Convert a user/system content payload into Responses API content parts:
 * `input_text` / `input_image` / `input_file`. File parts are still
 * serialized as text (same shape as chat.completions [messages.ts:42-52])
 * because OpenAI's Responses input_file expects a real file_id, not raw
 * base64 — keeping the JSON-in-text encoding preserves backward
 * compatibility with how the library already ships file contents.
 */
const convertUserContent = (
  content: ThreadMessageLike["content"]
): string | ResponseInputContent[] => {
  if (typeof content === "string") return content;

  return content.map((part): ResponseInputContent => {
    if (part.type === "text") {
      return { type: "input_text", text: part.text };
    }

    if (part.type === "file") {
      const meta = JSON.parse(part.mimeType);
      return {
        type: "input_text",
        text: JSON.stringify({
          file_data: part.data,
          filename: meta.path,
          file_id: meta.path,
        }),
      };
    }

    if (part.type === "image") {
      return {
        type: "input_image",
        image_url: part.image,
        detail: "auto",
      };
    }

    return { type: "input_text", text: "" };
  });
};

/**
 * Walk an assistant `ThreadMessageLike` and split it into Responses API
 * input items: one assistant message (text only), zero or more
 * `function_call` items, and the matching `function_call_output` items
 * for results that already exist. Reasoning parts from history are
 * intentionally dropped — OpenAI's Responses API does not require prior
 * reasoning summaries to be replayed, and including them adds noise.
 */
const splitAssistantMessage = (
  message: ThreadMessageLike
): ResponseInputItem[] => {
  const items: ResponseInputItem[] = [];

  if (typeof message.content === "string") {
    if (message.content.length > 0) {
      items.push({
        role: "assistant",
        content: message.content,
      });
    }
    return items;
  }

  let assistantText = "";
  const functionCalls: ResponseInputItem[] = [];
  const functionOutputs: ResponseInputItem[] = [];

  for (const part of message.content) {
    if (part.type === "text") {
      assistantText += part.text;
      continue;
    }

    if (part.type === "reasoning") {
      // Drop — see function-level comment.
      continue;
    }

    if (part.type !== "tool-call") continue;

    const callId = part.toolCallId ?? generateFallbackCallId();

    functionCalls.push({
      type: "function_call",
      call_id: callId,
      name: part.toolName,
      arguments: part.argsText ?? "",
    });

    if (part.result !== undefined && part.result !== null) {
      const output =
        typeof part.result === "string"
          ? part.result
          : JSON.stringify(part.result);
      functionOutputs.push({
        type: "function_call_output",
        call_id: callId,
        output,
      });
    }
  }

  if (assistantText.length > 0) {
    items.push({ role: "assistant", content: assistantText });
  }
  // function_call items must precede their function_call_output items —
  // emit them in the order calls→outputs to keep the model's view of the
  // exchange in sync.
  items.push(...functionCalls, ...functionOutputs);

  return items;
};

/**
 * Convert the thread's message array into the Responses API `input[]`
 * shape. The system prompt is **not** included here — Responses passes
 * it via the top-level `instructions` field, kept separate so it can be
 * swapped between turns without rewriting history.
 *
 * @param messages - The thread as a flat array of `ThreadMessageLike`.
 * @param downgradeSystem - When `true`, mid-conversation `system`
 *   messages are converted to `user` (matches the chat-completions
 *   behavior; preserved here for symmetry but unlikely to be needed
 *   against api.openai.com).
 */
export const convertMessagesToResponses = (
  messages: ThreadMessageLike[],
  downgradeSystem = false
): ResponseInputItem[] => {
  const result: ResponseInputItem[] = [];

  for (const message of messages) {
    if (message.role === "user" || message.role === "system") {
      const role =
        message.role === "system" && downgradeSystem ? "user" : message.role;
      result.push({
        role,
        content: convertUserContent(message.content),
      } as ResponseInputItem);
      continue;
    }

    result.push(...splitAssistantMessage(message));
  }

  return result;
};

/**
 * Convert MCP tool descriptors into Responses API `FunctionTool` shape.
 * Unlike Chat Completions, Responses tools are flat — no `function:`
 * wrapping.
 */
export const convertToolsToResponses = (tools: TMCPItem[]): FunctionTool[] =>
  tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: { ...tool.inputSchema },
    strict: false,
  }));
