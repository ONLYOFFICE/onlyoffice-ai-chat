import type {
  ReasoningMessagePart,
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { SendMessageResult } from "../../../shared/send-message-args";
import {
  createEmptyResponse,
  createErrorResponse,
  createStopResponse,
  finalizeReasoning,
} from "./stream";

/**
 * Streaming iterable returned by `client.responses.create({stream:true})`.
 */
type ResponsesStream = AsyncIterable<ResponseStreamEvent>;

/**
 * Append a reasoning delta to the current response, extending the trailing
 * `reasoning` part if one exists, otherwise pushing a new one. Mirrors
 * {@link handleReasoning} in `stream.ts` — kept separate so reasoning
 * summary streams from Responses can land in the same content shape.
 */
const appendReasoning = (
  responseMessage: ThreadMessageLike,
  delta: string
): ThreadMessageLike => {
  if (!delta || !Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (!lastPart || lastPart.type !== "reasoning") {
    content.push({ type: "reasoning", text: delta } as ReasoningMessagePart);
  } else {
    content[content.length - 1] = {
      ...lastPart,
      text: lastPart.text + delta,
    };
  }

  return { ...responseMessage, content };
};

/**
 * Append a text delta. New text part is forced after `reasoning` or
 * `tool-call` so the three streams stay visually separated even when
 * Responses interleaves them within one logical response.
 */
const appendText = (
  responseMessage: ThreadMessageLike,
  delta: string
): ThreadMessageLike => {
  if (!delta || !Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  const lastPart = content[content.length - 1];

  if (!lastPart) {
    content.push({ type: "text", text: delta });
  } else if (lastPart.type === "text") {
    content[content.length - 1] = { ...lastPart, text: lastPart.text + delta };
  } else {
    content.push({ type: "text", text: delta });
  }

  return { ...responseMessage, content };
};

/**
 * Create a fresh `tool-call` part for a newly-added `function_call` output
 * item. The item arrives with `call_id` and `name` populated; arguments
 * stream in later through `response.function_call_arguments.delta` events.
 */
const createToolCallPart = (
  callId: string,
  name: string,
  initialArgs = ""
): ToolCallMessagePart =>
  ({
    type: "tool-call",
    args: {},
    argsText: initialArgs,
    toolName: name,
    toolCallId: callId,
  }) as ToolCallMessagePart;

/**
 * Walk a Responses API streaming response and yield snapshot-style
 * `SendMessageResult`s in the same shape as the chat.completions
 * {@link processStream} — one snapshot per event, one terminal
 * `{ isEnd: true, responseMessage }` on `response.completed`. Function
 * call arguments are routed by `item_id` because Responses can interleave
 * multiple in-flight calls.
 */
export async function* processResponsesStream(
  stream: ResponsesStream,
  signal?: AbortSignal
): AsyncGenerator<SendMessageResult> {
  let responseMessage: ThreadMessageLike = createEmptyResponse();
  let hasUnfinalizedReasoning = false;
  // item_id → index inside responseMessage.content[] for the tool-call
  // part that owns this function_call output item. Lets us locate the
  // part when a `function_call_arguments.delta` arrives later.
  const toolCallIndexByItemId = new Map<string, number>();

  for await (const event of stream) {
    let mutated = true;

    switch (event.type) {
      case "response.output_item.added": {
        const item = event.item;
        if (item.type === "function_call") {
          if (hasUnfinalizedReasoning) {
            responseMessage = finalizeReasoning(responseMessage);
            hasUnfinalizedReasoning = false;
          }
          if (Array.isArray(responseMessage.content)) {
            const next = [...responseMessage.content];
            const part = createToolCallPart(
              item.call_id,
              item.name,
              item.arguments ?? ""
            );
            const insertIndex = next.length;
            next.push(part);
            toolCallIndexByItemId.set(event.item.id ?? "", insertIndex);
            responseMessage = { ...responseMessage, content: next };
          }
        } else {
          mutated = false;
        }
        break;
      }

      case "response.function_call_arguments.delta": {
        const idx = toolCallIndexByItemId.get(event.item_id);
        if (idx === undefined || !Array.isArray(responseMessage.content)) {
          mutated = false;
          break;
        }
        const next = [...responseMessage.content];
        const existing = next[idx] as ToolCallMessagePart;
        const argsText = (existing.argsText ?? "") + event.delta;
        let parsedArgs = existing.args ?? {};
        try {
          parsedArgs = JSON.parse(argsText || "{}");
        } catch {
          // partial JSON — keep previous parse
        }
        next[idx] = { ...existing, argsText, args: parsedArgs };
        responseMessage = { ...responseMessage, content: next };
        break;
      }

      case "response.function_call_arguments.done": {
        const idx = toolCallIndexByItemId.get(event.item_id);
        if (idx === undefined || !Array.isArray(responseMessage.content)) {
          mutated = false;
          break;
        }
        const next = [...responseMessage.content];
        const existing = next[idx] as ToolCallMessagePart;
        let parsedArgs = existing.args ?? {};
        try {
          parsedArgs = JSON.parse(event.arguments || "{}");
        } catch {
          // keep partial parse
        }
        next[idx] = {
          ...existing,
          argsText: event.arguments,
          args: parsedArgs,
        };
        responseMessage = { ...responseMessage, content: next };
        break;
      }

      case "response.output_text.delta": {
        if (hasUnfinalizedReasoning) {
          responseMessage = finalizeReasoning(responseMessage);
          hasUnfinalizedReasoning = false;
        }
        responseMessage = appendText(responseMessage, event.delta);
        break;
      }

      case "response.reasoning_summary_text.delta": {
        hasUnfinalizedReasoning = true;
        responseMessage = appendReasoning(responseMessage, event.delta);
        break;
      }

      case "response.completed": {
        if (hasUnfinalizedReasoning) {
          responseMessage = finalizeReasoning(responseMessage, true);
          hasUnfinalizedReasoning = false;
        }
        yield { isEnd: true, responseMessage };
        return;
      }

      case "response.failed": {
        const failure = event.response.error?.message ?? "Response failed";
        yield {
          isEnd: true,
          responseMessage: createErrorResponse(new Error(failure)),
        };
        return;
      }

      case "error": {
        yield {
          isEnd: true,
          responseMessage: createErrorResponse(new Error(event.message)),
        };
        return;
      }

      default:
        mutated = false;
        break;
    }

    if (mutated) yield responseMessage;
  }

  // Stream ended without `response.completed` — surface what we have or
  // an error so the caller's terminal handler always fires.
  const hasContent =
    typeof responseMessage.content === "string"
      ? responseMessage.content.length > 0
      : responseMessage.content.length > 0;

  if (hasContent) {
    if (hasUnfinalizedReasoning) {
      responseMessage = finalizeReasoning(responseMessage, true);
    }
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
