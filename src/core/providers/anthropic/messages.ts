import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/index.mjs";
import type { ThreadMessageLike } from "@assistant-ui/react";

type ImageMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const MIME_TYPE_MAP: Record<string, ImageMimeType> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const DEFAULT_MIME_TYPE: ImageMimeType = "image/jpeg";

/**
 * Split a `data:...;base64,...` URL into its base64 payload + mime type.
 * Returns `null` when the string is not a base64 data URL or carries an
 * empty payload (e.g. a 0-byte file the user attached) — Anthropic's SDK
 * rejects an empty `data` field, so the caller drops the block instead.
 */
const parseDataUrl = (
  dataUrl: string
): { base64: string; mimeType: string } | null => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { base64: match[2], mimeType: match[1] };
};

/** Normalize an arbitrary mime string to one Anthropic accepts. */
const toValidMimeType = (mimeType: string): ImageMimeType =>
  MIME_TYPE_MAP[mimeType] ?? DEFAULT_MIME_TYPE;

/**
 * Convert a base64 data URL image into Anthropic's `image` content block.
 *
 * @param imageDataUrl - `data:image/<kind>;base64,<payload>` URL.
 * @returns An Anthropic content block suitable for a user message.
 */
const convertImageToBlock = (imageDataUrl: string): ContentBlockParam => {
  const parsed = parseDataUrl(imageDataUrl);
  // Empty / malformed data URL — degrade to inert text so the converter
  // never feeds the SDK an empty `data` field (which it rejects).
  if (!parsed) return { type: "text", text: "" };
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: toValidMimeType(parsed.mimeType),
      data: parsed.base64,
    },
  };
};

type ContentPart = Exclude<ThreadMessageLike["content"], string>[number];

/**
 * Map a text part (or an unknown part, degraded into empty text) onto
 * Anthropic's content block format.
 */
const convertTextPart = (part: ContentPart): ContentBlockParam =>
  part.type === "text"
    ? { type: "text", text: part.text }
    : { type: "text", text: "" };

/**
 * Serialize a file part into Anthropic's `document` block with plain-text
 * media type. Unknown payloads fall back to empty text.
 */
const convertFilePart = (part: ContentPart): ContentBlockParam => {
  if (part.type !== "file") return { type: "text", text: "" };
  return {
    type: "document",
    source: {
      type: "text",
      media_type: "text/plain",
      data: part.data,
    },
    context: JSON.parse(part.mimeType).path,
  };
};

/**
 * Map an image part to Anthropic's image block. Non-image input
 * degrades into empty text so the converter never throws.
 */
const convertImagePart = (part: ContentPart): ContentBlockParam => {
  if (part.type !== "image") return { type: "text", text: "" };
  return convertImageToBlock(part.image);
};

/** Dispatcher for user-role content parts. */
const convertUserContentPart = (part: ContentPart): ContentBlockParam => {
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.type === "file") return convertFilePart(part);
  if (part.type === "image") return convertImagePart(part);
  return { type: "text", text: "" };
};

/** Translate one user-role message into Anthropic's wire format. */
const convertUserMessage = (message: ThreadMessageLike): MessageParam[] => {
  const content: MessageParam["content"] =
    typeof message.content === "string"
      ? message.content
      : message.content.map(convertUserContentPart);
  return [{ role: "user", content }];
};

/**
 * Anthropic has no mid-conversation `system` role — we demote the
 * message to a user turn (the system prompt itself is set separately via
 * `messages.create(..., { system })`).
 */
const convertSystemMessage = (message: ThreadMessageLike): MessageParam[] => {
  const content: MessageParam["content"] =
    typeof message.content === "string"
      ? message.content
      : message.content.map(convertTextPart);
  return [{ role: "user", content }];
};

/**
 * Translate an assistant turn, potentially splitting it into multiple
 * wire messages when tool-use blocks have attached results — Anthropic
 * expects `tool_result` blocks to arrive as a subsequent user message.
 */
const convertAssistantMessage = (
  message: ThreadMessageLike
): MessageParam[] => {
  const result: MessageParam[] = [];

  if (typeof message.content === "string") {
    return [{ role: "assistant", content: message.content || [] }];
  }

  let content: ContentBlockParam[] = [];
  let toolResults: ToolResultBlockParam[] = [];

  for (const part of message.content) {
    if (part.type === "reasoning") {
      content.push({
        type: "thinking",
        thinking: part.text,
        signature: part.parentId ?? "",
      });
      continue;
    }

    if (part.type === "text") {
      content.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "tool-call") {
      if (part.result) {
        toolResults.push({
          type: "tool_result",
          content: part.result,
          tool_use_id: part.toolCallId ?? "",
        });
      }

      content.push({
        type: "tool_use",
        id: part.toolCallId ?? "",
        name: part.toolName,
        input: part.args || {},
      });

      result.push({ role: "assistant", content });

      if (toolResults.length) {
        result.push({ role: "user", content: toolResults });
        toolResults = [];
      }

      content = [];
    }
  }

  if (content.length) {
    result.push({ role: "assistant", content });
  }

  return result;
};

/**
 * Convert the full thread into Anthropic's `MessageParam` array.
 *
 * Note: a single assistant `ThreadMessageLike` can expand into 1–3 wire
 * messages when it interleaves tool_use + tool_result + subsequent text.
 *
 * @param messages - The thread history + the latest turn.
 * @returns A flat array ready for `client.messages.create`.
 */
export const convertMessages = (
  messages: ThreadMessageLike[]
): MessageParam[] =>
  messages.flatMap((message) => {
    if (message.role === "user") return convertUserMessage(message);
    if (message.role === "system") return convertSystemMessage(message);
    return convertAssistantMessage(message);
  });
