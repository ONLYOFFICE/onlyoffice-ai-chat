import type {
  ReasoningMessagePart,
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { toChatError } from "../../services/ai/error";

/**
 * Extension of OpenAI's streaming delta that adds the non-standard
 * thinking fields. Two spellings are in the wild and a backend picks one:
 * `reasoning_content` (DeepSeek R1, ONLYOFFICE `-thinking` variants) and
 * `reasoning` (OpenRouter and the gateways that copy it). `reasoning` is
 * also where some backends put a structured object rather than a string,
 * so read it through {@link readReasoningDelta} instead of directly.
 */
export type DeltaWithReasoning = ChatCompletionChunk.Choice["delta"] & {
  reasoning_content?: string;
  reasoning?: unknown;
};

/**
 * Pull the thinking fragment out of a delta, whichever field carries it.
 * `reasoning_content` wins when a backend sends both. A non-string
 * `reasoning` (an object, as some gateways send) is ignored rather than
 * stringified into the transcript.
 *
 * @param delta - One streaming delta.
 * @returns The fragment, or `undefined` when the delta carries none.
 */
export const readReasoningDelta = (
  delta: DeltaWithReasoning
): string | undefined => {
  if (delta.reasoning_content) return delta.reasoning_content;
  return typeof delta.reasoning === "string" && delta.reasoning
    ? delta.reasoning
    : undefined;
};

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

/**
 * Fresh assistant response shell with an empty content array. Every
 * `sendMessage` call starts from this and accumulates parts as deltas
 * arrive.
 */
export const createEmptyResponse = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

/**
 * Terminal response indicating the stream failed. Carries the error so
 * the caller can inspect it (logging, retry classification, UI toast).
 *
 * @param error - The error thrown by the SDK or fetch layer.
 */
export const createErrorResponse = (error: unknown): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: {
      type: "incomplete",
      reason: "error",
      error: toChatError(error),
    },
  }) as ThreadMessageLike;

/**
 * Terminal response indicating the caller aborted the stream (via the
 * `AbortSignal` passed in `sendMessage` args). Distinguished from errors
 * so the UI can show "Stopped" instead of "Error".
 */
export const createStopResponse = (): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: { type: "incomplete", reason: "cancelled" },
  }) as ThreadMessageLike;

// ---------------------------------------------------------------------------
// Reasoning delta handlers
// ---------------------------------------------------------------------------

/** Build a short, unique id used to associate finalized reasoning parts. */
const generateReasoningId = (): string =>
  `reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Append a reasoning delta onto the response. If the last part is already
 * a `reasoning` part, extend its text; otherwise push a new reasoning
 * part.
 *
 * @param responseMessage  - The accumulating response.
 * @param reasoningContent - The latest `reasoning_content` fragment.
 * @returns The updated response message.
 */
export const handleReasoning = (
  responseMessage: ThreadMessageLike,
  reasoningContent: string
): ThreadMessageLike => {
  if (!reasoningContent) return responseMessage;
  if (!Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (!lastPart || lastPart.type !== "reasoning") {
    content.push({
      type: "reasoning",
      text: reasoningContent,
    } as ReasoningMessagePart);
  } else {
    content[content.length - 1] = {
      ...lastPart,
      text: lastPart.text + reasoningContent,
    };
  }

  return { ...responseMessage, content };
};

/**
 * Mark every pending reasoning part as finalized by assigning a stable
 * `parentId`. Called when the reasoning segment is over (non-reasoning
 * delta arrives, or the stream ends).
 *
 * @param responseMessage - The accumulating response.
 * @param addEmptyText    - When `true`, append an empty text part after
 *   the finalized reasoning so the UI has a slot to drop text into if the
 *   stream actually ends here.
 * @returns The updated response message.
 */
export const finalizeReasoning = (
  responseMessage: ThreadMessageLike,
  addEmptyText = false
): ThreadMessageLike => {
  if (!Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];

  for (let i = 0; i < content.length; i++) {
    const part = content[i];
    if (part.type === "reasoning" && !part.parentId) {
      content[i] = { ...part, parentId: generateReasoningId() };
    }
  }

  if (addEmptyText) {
    const lastPart = content[content.length - 1];
    if (lastPart?.type === "reasoning") {
      content.push({ type: "text", text: "" });
    }
  }

  return { ...responseMessage, content };
};

// ---------------------------------------------------------------------------
// Text delta handler
// ---------------------------------------------------------------------------

/**
 * Append a text delta. Appends to the last `text` part if one exists;
 * otherwise starts a new text part. A new text part is also forced when
 * the previous part is `reasoning` (so text is visually separated from
 * the thinking transcript).
 *
 * @param responseMessage - The accumulating response.
 * @param chunk           - The streaming choice carrying the text delta.
 * @returns The updated response message.
 */
export const handleText = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice
): ThreadMessageLike => {
  const delta = chunk.delta.content;
  if (!delta) return responseMessage;
  if (!Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (!lastPart) {
    content.push({ type: "text", text: delta });
  } else if (lastPart.type === "text") {
    content[content.length - 1] = { ...lastPart, text: lastPart.text + delta };
  } else {
    // After reasoning, tool-call, or any other non-text part, start a
    // new text part so the delta is not silently dropped.
    content.push({ type: "text", text: delta });
  }

  return { ...responseMessage, content };
};

// ---------------------------------------------------------------------------
// Tool-call delta handler
// ---------------------------------------------------------------------------

/**
 * Create a fresh `tool-call` part from a streaming delta. All fields are
 * populated with whatever the delta carried; they may be empty strings
 * that later deltas will fill in via {@link mergeToolCall}.
 */
const createToolCallPart = (
  delta?: ChatCompletionChunk.Choice["delta"]
): ToolCallMessagePart =>
  ({
    type: "tool-call",
    args: {},
    argsText: delta?.tool_calls?.[0]?.function?.arguments ?? "",
    toolName: delta?.tool_calls?.[0]?.function?.name ?? "",
    toolCallId: delta?.tool_calls?.[0]?.id ?? "",
  }) as ToolCallMessagePart;

/**
 * Merge an incoming tool-call delta into the in-progress part. Tool-call
 * arguments stream in as a concatenation of JSON fragments — we keep the
 * raw `argsText` and opportunistically try to parse `args` whenever the
 * accumulated fragment is valid JSON.
 */
const mergeToolCall = (
  existing: ToolCallMessagePart,
  delta?: ChatCompletionChunk.Choice["delta"]
): ToolCallMessagePart => {
  const update = delta?.tool_calls?.[0];
  const argsText = existing.argsText + (update?.function?.arguments ?? "");

  // Arguments stream as concatenated JSON fragments. Re-parsing the whole
  // accumulated string on every delta is O(n²) over a long argument stream,
  // and only a balanced fragment can parse anyway — so only attempt a parse
  // once the trimmed text looks complete (ends with `}`), mirroring the
  // Anthropic path. The try/catch still guards the rare mid-string `}` case.
  let parsedArgs = existing.args;
  const trimmed = argsText.trim();
  if (trimmed === "") {
    parsedArgs = {};
  } else if (trimmed.endsWith("}")) {
    try {
      parsedArgs = JSON.parse(trimmed);
    } catch {
      // arguments still incomplete — keep previous parse attempt
    }
  }

  return {
    ...existing,
    args: parsedArgs,
    argsText,
    toolName: existing.toolName || update?.function?.name || "",
    toolCallId: existing.toolCallId || update?.id || "",
  };
};

/**
 * Append or extend a tool-call part from a streaming delta. If the last
 * part is already a tool-call, the delta is merged into it; otherwise a
 * new tool-call part is pushed.
 *
 * @param responseMessage - The accumulating response.
 * @param chunk           - The streaming choice carrying the tool-call delta.
 * @returns The updated response message.
 */
export const handleToolCall = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice
): ThreadMessageLike => {
  const delta = chunk.delta.tool_calls;
  if (!delta || !Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (!lastPart || lastPart.type !== "tool-call") {
    content.push(createToolCallPart(chunk.delta));
  } else {
    content[content.length - 1] = mergeToolCall(lastPart, chunk.delta);
  }

  return { ...responseMessage, content };
};

// ---------------------------------------------------------------------------
// Full stream processor
// ---------------------------------------------------------------------------

/** Streaming iterable returned by OpenAI's `chat.completions.create`. */
type OpenAIStream = AsyncIterable<ChatCompletionChunk>;

/**
 * Walk an OpenAI streaming response and yield snapshot-style
 * `SendMessageResult`s:
 *
 *  - one `ThreadMessageLike` snapshot per streaming event (UI can diff
 *    successive snapshots to derive deltas);
 *  - one final `{ isEnd: true, responseMessage }` when the stream ends.
 *
 * Recognises text, reasoning, and tool-call deltas, sequencing reasoning
 * finalization correctly when text or tools start arriving after thinking.
 *
 * @param stream - The async iterable returned by the SDK.
 * @yields Intermediate snapshots and, last, the terminal `isEnd` result.
 */
export async function* processStream(
  stream: OpenAIStream,
  signal?: AbortSignal
): AsyncGenerator<SendMessageResult> {
  let responseMessage: ThreadMessageLike = createEmptyResponse();
  let isStreamComplete = false;
  let hasUnfinalizedReasoning = false;

  for await (const streamEvent of stream) {
    const prev = responseMessage;
    for (const chunk of streamEvent.choices) {
      if (isStreamComplete) break;

      const delta = chunk.delta as DeltaWithReasoning;

      if (chunk.finish_reason) {
        if (hasUnfinalizedReasoning) {
          responseMessage = finalizeReasoning(responseMessage, true);
        }
        isStreamComplete = true;
        break;
      }

      const reasoningDelta = readReasoningDelta(delta);
      if (reasoningDelta) {
        hasUnfinalizedReasoning = true;
        responseMessage = handleReasoning(responseMessage, reasoningDelta);
      }

      if (delta.content) {
        if (hasUnfinalizedReasoning) {
          responseMessage = finalizeReasoning(responseMessage);
          hasUnfinalizedReasoning = false;
        }
        responseMessage = handleText(responseMessage, chunk);
      }

      if (delta.tool_calls && Array.isArray(responseMessage.content)) {
        if (hasUnfinalizedReasoning) {
          responseMessage = finalizeReasoning(responseMessage);
          hasUnfinalizedReasoning = false;
        }
        responseMessage = handleToolCall(responseMessage, chunk);
      }
    }

    if (isStreamComplete) {
      yield { isEnd: true, responseMessage };
      return;
    }

    // Emit only when a chunk actually mutated the message — the content
    // handlers return fresh objects, so an unchanged reference means a
    // no-op event (role-only first chunk, usage-only frame, keepalive) and
    // skipping it avoids a redundant downstream write + re-render.
    if (responseMessage !== prev) yield responseMessage;
  }

  // Stream closed without a `finish_reason` — salvage whatever we got.
  const hasContent =
    typeof responseMessage.content === "string"
      ? responseMessage.content.length > 0
      : responseMessage.content.length > 0;

  if (hasContent) {
    yield { isEnd: true, responseMessage };
  } else if (signal?.aborted) {
    // User stopped before any content arrived — the SDK closes the
    // iterator without throwing, so treat the empty end as a cancellation
    // rather than an error.
    yield { isEnd: true, responseMessage: createStopResponse() };
  } else {
    yield {
      isEnd: true,
      responseMessage: createErrorResponse(
        new Error("Stream ended unexpectedly without response")
      ),
    };
  }
}
