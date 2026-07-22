import type {
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { GenerateContentResponse } from "@google/genai";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { toChatError } from "../../services/ai/error";

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

/** Fresh assistant response shell, used as the seed for a new stream. */
export const createEmptyResponse = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

/** Terminal response when the SDK threw mid-stream. */
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

/** Terminal response when the caller aborted the stream. */
export const createStopResponse = (): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: { type: "incomplete", reason: "cancelled" },
  }) as ThreadMessageLike;

// ---------------------------------------------------------------------------
// Part handlers
// ---------------------------------------------------------------------------

/**
 * Extend or start a `reasoning` part with an incoming thought fragment.
 * Gemini emits thoughts as ordinary text parts flagged with `thought:
 * true`, so we route them here rather than to the plain text handler.
 */
export const handleThought = (
  responseMessage: ThreadMessageLike,
  text: string
): ThreadMessageLike => {
  if (!text) return responseMessage;
  if (typeof responseMessage.content === "string") return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (lastPart?.type === "reasoning") {
    content[content.length - 1] = {
      ...lastPart,
      text: lastPart.text + text,
    };
  } else {
    content.push({ type: "reasoning", text });
  }

  return { ...responseMessage, content };
};

/**
 * Extend or start a `text` part with an incoming text fragment.
 */
export const handleText = (
  responseMessage: ThreadMessageLike,
  text: string
): ThreadMessageLike => {
  if (!text) return responseMessage;
  if (typeof responseMessage.content === "string") return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (lastPart?.type === "text") {
    content[content.length - 1] = { ...lastPart, text: lastPart.text + text };
  } else {
    content.push({ type: "text", text });
  }

  return { ...responseMessage, content };
};

/**
 * Append a tool-call part from a Gemini function call. Attaches the
 * `thoughtSignature` (Gemini 3+) in a private `metadata` field so the
 * caller can send it back on the next turn.
 */
export const handleFunctionCall = (
  responseMessage: ThreadMessageLike,
  functionCall: {
    name: string;
    args: Record<string, unknown>;
    thoughtSignature?: string;
  }
): ThreadMessageLike => {
  if (typeof responseMessage.content === "string") return responseMessage;

  const content = [...responseMessage.content];
  const toolCallPart = {
    type: "tool-call",
    toolCallId: crypto.randomUUID(),
    toolName: functionCall.name,
    args: functionCall.args,
    argsText: JSON.stringify(functionCall.args),
    ...(functionCall.thoughtSignature && {
      metadata: { thoughtSignature: functionCall.thoughtSignature },
    }),
  } as ToolCallMessagePart;

  content.push(toolCallPart);
  return { ...responseMessage, content };
};

/**
 * Fold one GenAI `GenerateContentResponse` chunk into the accumulating
 * response. Walks every part of the first candidate and dispatches it to
 * the matching handler (thought / text / functionCall).
 *
 * @param responseMessage - The accumulating response.
 * @param response        - One chunk from `generateContentStream`.
 * @returns The updated response message.
 */
export const processChunk = (
  responseMessage: ThreadMessageLike,
  response: GenerateContentResponse
): ThreadMessageLike => {
  let result = responseMessage;

  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) return result;

  for (const part of candidate.content.parts) {
    if (part.thought) {
      result = handleThought(result, part.text ?? "");
    }
    if (part.text && !part.thought) {
      result = handleText(result, part.text);
    }
    if (part.functionCall) {
      result = handleFunctionCall(result, {
        name: part.functionCall.name ?? "",
        args: (part.functionCall.args as Record<string, unknown>) ?? {},
        thoughtSignature: (part as unknown as { thoughtSignature?: string })
          .thoughtSignature,
      });
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// Full stream processor
// ---------------------------------------------------------------------------

type GenAIStream = AsyncIterable<GenerateContentResponse>;

/**
 * Walk a GenAI streaming response and yield snapshot-style
 * `SendMessageResult`s. Every chunk extends the accumulating response;
 * when the stream ends a terminal `{ isEnd: true }` is yielded.
 *
 * Abort detection is handled by the caller (it owns the signal and the
 * error classification).
 *
 * @param stream - Async iterable from `generateContentStream`.
 * @param signal - Optional signal for early-exit check before each chunk.
 * @yields Intermediate snapshots and, last, the terminal `isEnd` result.
 */
export async function* processStream(
  stream: GenAIStream,
  signal?: AbortSignal
): AsyncGenerator<SendMessageResult> {
  let responseMessage = createEmptyResponse();

  for await (const chunk of stream) {
    if (signal?.aborted) {
      yield { isEnd: true, responseMessage: createStopResponse() };
      return;
    }
    const prev = responseMessage;
    responseMessage = processChunk(responseMessage, chunk);
    // `processChunk` returns the same reference for a content-free chunk;
    // only emit a snapshot when it actually changed.
    if (responseMessage !== prev) yield responseMessage;
  }

  yield { isEnd: true, responseMessage };
}
