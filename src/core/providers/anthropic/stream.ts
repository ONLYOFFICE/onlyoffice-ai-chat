import type Anthropic from "@anthropic-ai/sdk";
import type {
  ReasoningMessagePart,
  TextMessagePart,
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { SendMessageResult } from "../../../shared/send-message-args";

type ContentArray = (
  | TextMessagePart
  | ToolCallMessagePart
  | ReasoningMessagePart
)[];

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

/** Fresh assistant response shell used as the seed for a new stream. */
export const createEmptyResponse = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

/**
 * Terminal response when the SDK threw mid-stream. Carries the original
 * error so the caller can classify / retry / display it.
 */
export const createErrorResponse = (error: unknown): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: { type: "incomplete", reason: "error", error },
  }) as ThreadMessageLike;

/**
 * Terminal response when the caller aborted the stream. Distinct from
 * error so UI can show "Stopped" instead of "Error".
 */
export const createStopResponse = (): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: { type: "incomplete", reason: "cancelled" },
  }) as ThreadMessageLike;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cloneMessage = (message: ThreadMessageLike): ThreadMessageLike => ({
  ...message,
  content: Array.isArray(message.content)
    ? [...message.content]
    : message.content,
});

const getContentArray = (message: ThreadMessageLike): ContentArray | null =>
  Array.isArray(message.content) ? message.content : null;

const getLastContent = (content: ContentArray) => content[content.length - 1];

const createTextPart = (text: string): TextMessagePart => ({
  type: "text",
  text,
});

const createToolCallPart = (id: string, name: string): ToolCallMessagePart => ({
  type: "tool-call",
  toolCallId: id,
  toolName: name,
  args: {},
  argsText: "",
});

// ---------------------------------------------------------------------------
// content_block_start handlers
// ---------------------------------------------------------------------------

const handleTextBlockStart = (
  block: Anthropic.Messages.TextBlock,
  content: ContentArray
): void => {
  content.push(createTextPart(block.text));
};

const handleThinkingBlockStart = (
  block: { thinking: string },
  content: ContentArray
): void => {
  content.push({ type: "reasoning", text: block.thinking });
};

const handleToolUseBlockStart = (
  block: Anthropic.Messages.ToolUseBlock,
  content: ContentArray
): void => {
  content.push(createToolCallPart(block.id, block.name));
};

// ---------------------------------------------------------------------------
// content_block_delta handlers
// ---------------------------------------------------------------------------

const handleTextDelta = (
  delta: Anthropic.Messages.TextDelta,
  content: ContentArray
): void => {
  const last = getLastContent(content);
  if (last?.type !== "text") return;
  content[content.length - 1] = createTextPart(last.text + delta.text);
};

const handleThinkingDelta = (
  delta: { thinking: string },
  content: ContentArray
): void => {
  const last = getLastContent(content);
  if (last?.type !== "reasoning") return;
  content[content.length - 1] = { ...last, text: last.text + delta.thinking };
};

/**
 * Thinking blocks are closed by a signature. We stash the signature on
 * the reasoning part's `parentId` so the conversion back to Anthropic
 * format (in {@link messages.ts}) can restore it.
 */
const handleSignatureDelta = (
  delta: { signature: string },
  content: ContentArray
): void => {
  const last = getLastContent(content);
  if (last?.type !== "reasoning") return;
  content[content.length - 1] = { ...last, parentId: delta.signature };
};

/**
 * Tool-call arguments stream as a sequence of JSON fragments. Attempt to
 * parse whenever the accumulated fragment looks like complete JSON; the
 * raw text is always preserved on `argsText`.
 */
const tryParseJson = (text: string): ToolCallMessagePart["args"] => {
  if (!text.trim().endsWith("}")) return {};
  try {
    return JSON.parse(text) as ToolCallMessagePart["args"];
  } catch {
    return {};
  }
};

const handleInputJsonDelta = (
  delta: Anthropic.Messages.InputJSONDelta,
  content: ContentArray
): void => {
  const last = getLastContent(content);
  if (last?.type !== "tool-call") return;

  const argsText = last.argsText + delta.partial_json;
  content[content.length - 1] = {
    ...last,
    args: tryParseJson(argsText),
    argsText,
  };
};

// ---------------------------------------------------------------------------
// Exported event handlers
// ---------------------------------------------------------------------------

/** Seed a fresh response when Anthropic announces the message start. */
export const handleMessageStart = (
  event: Anthropic.Messages.RawMessageStartEvent
): ThreadMessageLike => ({
  role: event.message.role,
  content: [],
});

/**
 * Dispatch a `content_block_start` event. Each block (text / thinking /
 * tool_use) is appended onto the response. Also closes unclosed
 * `<think>` tags if the model emitted them inline.
 */
export const handleContentBlockStart = (
  event: Anthropic.Messages.ContentBlockStartEvent,
  prevMessage: ThreadMessageLike
): ThreadMessageLike => {
  const message = cloneMessage(prevMessage);
  const content = getContentArray(message);
  if (!content) return message;

  const { content_block } = event;

  const lastContent = getLastContent(content);
  if (
    lastContent?.type === "text" &&
    lastContent.text.startsWith("<think>") &&
    !lastContent.text.includes("</think>")
  ) {
    content[content.length - 1] = createTextPart(
      `${lastContent.text}\n</think>\n\n`
    );
  }

  if (content_block.type === "text") {
    handleTextBlockStart(content_block, content);
  } else if (content_block.type === "tool_use") {
    handleToolUseBlockStart(content_block, content);
  } else if (content_block.type === "thinking") {
    handleThinkingBlockStart(
      content_block as unknown as { thinking: string },
      content
    );
  }

  return message;
};

/**
 * Dispatch a `content_block_delta` event — extends the last content
 * part with the arriving fragment. Handles text, thinking, tool-call
 * JSON, and thinking signatures.
 */
export const handleContentBlockDelta = (
  event: Anthropic.Messages.RawContentBlockDeltaEvent,
  prevMessage: ThreadMessageLike
): ThreadMessageLike => {
  const message = cloneMessage(prevMessage);
  const content = getContentArray(message);
  if (!content) return message;

  const { delta } = event;

  if (delta.type === "text_delta") {
    handleTextDelta(delta, content);
  } else if (delta.type === "input_json_delta") {
    handleInputJsonDelta(delta, content);
  } else if ((delta as { type: string }).type === "thinking_delta") {
    handleThinkingDelta(delta as unknown as { thinking: string }, content);
  } else if ((delta as { type: string }).type === "signature_delta") {
    handleSignatureDelta(delta as unknown as { signature: string }, content);
  }

  return message;
};

// ---------------------------------------------------------------------------
// Full stream processor
// ---------------------------------------------------------------------------

/** Streaming iterable returned by `client.messages.create({ stream: true })`. */
type AnthropicStream = AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>;

/**
 * Walk an Anthropic streaming response and yield snapshot-style
 * `SendMessageResult`s. Each incoming event updates the accumulating
 * `ThreadMessageLike` in place; a `message_stop` event closes the stream
 * with the terminal `{ isEnd: true, responseMessage }`.
 *
 * @param stream - Async iterable of raw Anthropic stream events.
 * @yields Intermediate snapshots and, last, the terminal `isEnd` result.
 */
export async function* processStream(
  stream: AnthropicStream
): AsyncGenerator<SendMessageResult> {
  let responseMessage: ThreadMessageLike = createEmptyResponse();

  for await (const event of stream) {
    switch (event.type) {
      case "message_start":
        responseMessage = handleMessageStart(event);
        break;
      case "content_block_start":
        responseMessage = handleContentBlockStart(event, responseMessage);
        break;
      case "content_block_delta":
        responseMessage = handleContentBlockDelta(event, responseMessage);
        break;
      case "message_stop":
        yield { isEnd: true, responseMessage };
        return;
      default:
        break;
    }

    yield responseMessage;
  }
}
