import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  AssistantMessage,
  Messages,
  ToolMessage,
  UserMessage,
} from "@mistralai/mistralai/models/components";
import { parseGuardedImageDataUrl } from "../../../shared/image-data-url";

/**
 * Translate one user-role `ThreadMessageLike` into Mistral's wire format.
 *
 * A user message may produce:
 *  - a single `user` entry (text, attachments flattened into text),
 *  - plus optionally a following `tool` entry if any `tool-call` part
 *    inside it carries a non-empty `result`.
 *
 * Images and files are folded into text — the Mistral SDK in use here
 * doesn't expose a binary content channel through this library yet.
 */
const convertUserMessage = (msg: ThreadMessageLike): Messages[] => {
  const content: UserMessage["content"] = [];
  const toolContent: ToolMessage = { content: null };

  if (msg.attachments && msg.attachments.length > 0) {
    for (const attachment of msg.attachments) {
      if (attachment.type === "file") {
        content.push({
          type: "text",
          text: `File: ${attachment.name}: ${attachment.content}`,
        });
      } else if (attachment.type === "image") {
        content.push({
          type: "text",
          text: `Image: ${attachment.name}: ${attachment.content}`,
        });
      }
    }
  }

  if (typeof msg.content === "string") {
    content.push({ type: "text", text: msg.content });
  } else {
    for (const part of msg.content) {
      if (part.type === "text") {
        content.push({ type: "text", text: part.text });
      } else if (part.type === "tool-call") {
        toolContent.content = part.result || null;
        toolContent.name = part.toolName;
        toolContent.toolCallId = part.toolCallId;
      } else if (part.type === "image") {
        // This SDK path folds images into text; only embed an inlined
        // base64 data URL. A leftover ref or http(s) URL must not be
        // pasted in verbatim — substitute a placeholder.
        content.push({
          type: "text",
          text: parseGuardedImageDataUrl(part.image)
            ? `Image: ${part.filename}: ${part.image}`
            : `Image: ${part.filename ?? ""}: [image unavailable]`,
        });
      } else if (part.type === "file") {
        content.push({
          type: "text",
          text: `File: ${part.filename}: ${part.data}`,
        });
      }
    }
  }

  const out: Messages[] = [{ role: "user", content }];
  if (toolContent.content) {
    out.push({ role: "tool", ...toolContent });
  }
  return out;
};

/**
 * Translate one assistant-role `ThreadMessageLike` into a Mistral
 * `assistant` entry, folding reasoning and tool-calls into the SDK's
 * nested shapes.
 */
const convertAssistantMessage = (msg: ThreadMessageLike): Messages[] => {
  const content: AssistantMessage["content"] = [];
  const toolCalls: AssistantMessage["toolCalls"] = [];

  if (typeof msg.content === "string") {
    content.push({ type: "text", text: msg.content });
  } else {
    for (const part of msg.content) {
      if (part.type === "text") {
        content.push({ type: "text", text: part.text });
      } else if (part.type === "reasoning") {
        content.push({
          type: "thinking",
          thinking: [{ type: "text", text: part.text }],
        });
      } else if (part.type === "tool-call") {
        toolCalls.push({
          type: "function",
          id: part.parentId,
          function: {
            name: part.toolName,
            arguments:
              part.argsText || part.args ? JSON.stringify(part.args) : "",
          },
        });
      }
    }
  }

  return [
    {
      role: "assistant",
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    },
  ];
};

/**
 * Convert the thread into Mistral's `Messages[]` wire format.
 *
 * A single `ThreadMessageLike` can produce more than one wire entry
 * (e.g. user message + trailing tool result).
 *
 * @param messages - Thread history + latest turn.
 * @returns A flat array ready for `client.chat.stream` / `client.chat.complete`.
 */
export const convertMessages = (messages: ThreadMessageLike[]): Messages[] => {
  const result: Messages[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      result.push(...convertUserMessage(msg));
    } else if (msg.role === "assistant") {
      result.push(...convertAssistantMessage(msg));
    }
  }
  return result;
};
