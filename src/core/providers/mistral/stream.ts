import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  CompletionEvent,
  DeltaMessage,
} from "@mistralai/mistralai/models/components";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { toChatError } from "../../services/ai/error";

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

/** Fresh assistant response shell. */
export const createEmptyResponse = (): ThreadMessageLike => ({
  role: "assistant",
  content: [],
});

/**
 * Terminal response when the SDK threw mid-stream. Carries the error on
 * `status` (not as body text) so the engine surfaces `message-incomplete`
 * and the UI fires its error path — mirrors every other provider.
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

/** Terminal response when the caller aborted the stream. */
export const createStopResponse = (): ThreadMessageLike =>
  ({
    role: "assistant",
    content: "",
    status: { type: "incomplete", reason: "cancelled" },
  }) as ThreadMessageLike;

// ---------------------------------------------------------------------------
// Delta handlers
// ---------------------------------------------------------------------------

/**
 * Append a tool-call part from an incoming delta. Mistral sends
 * tool-call arguments as a single payload (not streamed per-token), so
 * each delta is a complete tool call.
 */
export const handleToolCall = (
  delta: DeltaMessage,
  responseMessage: ThreadMessageLike
): ThreadMessageLike => {
  if (!delta.toolCalls?.length) return responseMessage;
  if (typeof responseMessage.content === "string") return responseMessage;

  const toolCall = delta.toolCalls[0];
  const toolCallId = toolCall.id || "";
  const argsText = toolCall.function?.arguments || "{}";

  const toolCallPart: ThreadMessageLike["content"] = [
    {
      type: "tool-call",
      toolCallId,
      toolName: toolCall.function?.name || "",
      args: typeof argsText === "string" ? JSON.parse(argsText) : argsText,
      argsText:
        typeof argsText === "string" ? argsText : JSON.stringify(argsText),
      result: "",
      parentId: toolCallId,
    },
  ];

  return {
    ...responseMessage,
    content: [...responseMessage.content, ...toolCallPart],
  };
};

/**
 * Extend or start a `text` part with an incoming text delta. Mistral
 * emits plain incremental strings on `delta.content`.
 */
export const handleTextContent = (
  delta: DeltaMessage,
  responseMessage: ThreadMessageLike
): ThreadMessageLike => {
  if (
    typeof delta?.content !== "string" ||
    typeof responseMessage.content === "string"
  ) {
    return responseMessage;
  }

  const text = delta.content;
  const lastPart = responseMessage.content.at(-1);

  if (lastPart && lastPart.type === "text") {
    return {
      ...responseMessage,
      content: [
        ...responseMessage.content.slice(0, -1),
        { ...lastPart, text: lastPart.text + text },
      ],
    };
  }

  return {
    ...responseMessage,
    content: [...responseMessage.content, { type: "text", text }],
  };
};

/** Pull the first (and typically only) choice from a completion event. */
export const getChoiceFromEvent = (
  event: CompletionEvent
): CompletionEvent["data"]["choices"][number] | undefined =>
  event.data?.choices?.[0];

// ---------------------------------------------------------------------------
// Full stream processor
// ---------------------------------------------------------------------------

type MistralStream = AsyncIterable<CompletionEvent>;

/**
 * Walk a Mistral streaming response and yield snapshot-style
 * `SendMessageResult`s. Each event extends the accumulating response;
 * when a `finishReason` arrives the terminal `{ isEnd: true }` is yielded.
 *
 * @param stream - Async iterable from `client.chat.stream`.
 * @param signal - Optional signal for early-exit check between events.
 * @yields Intermediate snapshots and, last, the terminal `isEnd` result.
 */
export async function* processStream(
  stream: MistralStream,
  signal?: AbortSignal
): AsyncGenerator<SendMessageResult> {
  let responseMessage = createEmptyResponse();

  for await (const event of stream) {
    if (signal?.aborted) {
      yield { isEnd: true, responseMessage: createStopResponse() };
      return;
    }

    const choice = getChoiceFromEvent(event);
    if (!choice) continue;

    const delta = choice.delta;
    responseMessage = handleToolCall(delta, responseMessage);
    responseMessage = handleTextContent(delta, responseMessage);

    if (choice.finishReason) {
      yield { isEnd: true, responseMessage };
      return;
    }

    yield responseMessage;
  }
}
