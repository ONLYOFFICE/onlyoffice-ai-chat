import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatErrorPayload } from "./error";
import { readToolCall } from "./tool-call";
import type { ChatEvent } from "./types";

/**
 * OpenAI Chat Completions streaming shapes.
 *
 * {@link toOpenAIChatCompletionStream} maps the engine's transport-agnostic
 * {@link ChatEvent} stream onto these chunks so a host can expose an
 * OpenAI-compatible `POST /v1/chat/completions` (`stream: true`) endpoint
 * backed by the same chat pipeline as the in-app widget. Only the subset of
 * fields the engine can populate is emitted; everything else an OpenAI client
 * tolerates as absent.
 */
export type OpenAIFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | null;

export interface OpenAIToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: { name?: string; arguments?: string };
}

export interface OpenAIChoiceDelta {
  role?: "assistant";
  content?: string | null;
  tool_calls?: OpenAIToolCallDelta[];
}

export interface OpenAIChunkChoice {
  index: number;
  delta: OpenAIChoiceDelta;
  finish_reason: OpenAIFinishReason;
}

export interface OpenAIChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: OpenAIChunkChoice[];
}

/**
 * OpenAI streaming error envelope. When the upstream request fails
 * mid-stream the OpenAI API emits a single `data:` line carrying an
 * `error` object (no `choices`), then closes the stream — the official
 * SDK turns this into a thrown `APIError`. Mirrors that shape so a host
 * exposing an OpenAI-compatible endpoint stays wire-compatible.
 */
export interface OpenAIStreamError {
  error: {
    message: string;
    type: string;
    code: string | null;
    param: string | null;
  };
}

/** A chunk or the terminal error envelope emitted on a failed stream. */
export type OpenAIStreamChunk = OpenAIChatCompletionChunk | OpenAIStreamError;

/**
 * Map a core {@link ChatErrorPayload.code} to the closest OpenAI error
 * `type`. Unknown / provider-specific codes fall back to
 * `"server_error"` so clients still treat it as a failure.
 */
function toOpenAIErrorType(code: string | undefined): string {
  switch (code) {
    case "auth":
      return "authentication_error";
    case "rate_limit":
      return "rate_limit_error";
    case "bad_request":
    case "model_not_found":
    case "not_found":
      return "invalid_request_error";
    default:
      return "server_error";
  }
}

/** Build the OpenAI error envelope from a core error payload. */
function toOpenAIError(error: ChatErrorPayload | undefined): OpenAIStreamError {
  return {
    error: {
      message: error?.message ?? "The request failed",
      type: toOpenAIErrorType(error?.code),
      code: error?.code ?? null,
      param: null,
    },
  };
}

export type ToOpenAIStreamOptions = {
  /** Value for the chunk `model` field — typically the resolved `Profile.modelId`. */
  model: string;
  /**
   * Completion id, stable across every chunk. Defaults to one derived from
   * the first assistant `messageId` the engine surfaces.
   */
  id?: string;
  /** Unix-seconds `created` stamp. Defaults to the current time. */
  created?: number;
};

/** Concatenate the plain-text parts of a message's content. */
function extractText(content: ThreadMessageLike["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const part of content) {
    if (
      part &&
      typeof part === "object" &&
      (part as { type?: string }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      out += (part as { text: string }).text;
    }
  }
  return out;
}

/**
 * The new text appended since the last snapshot. The engine streams
 * cumulative snapshots; OpenAI clients expect incremental deltas. When a
 * snapshot doesn't extend the previous one (a rare mid-stream rewrite) we
 * fall back to emitting the whole snapshot.
 */
function textDelta(prev: string, full: string): string {
  return full.startsWith(prev) ? full.slice(prev.length) : full;
}

/**
 * Adapt the engine's {@link ChatEvent} stream into OpenAI
 * `chat.completion.chunk` objects.
 *
 * - `message-start` → first chunk carries `delta.role: "assistant"` plus any
 *   initial text.
 * - `message-delta` → `delta.content` with only the newly-appended text.
 * - `message-end` → flush any trailing text, then a terminal chunk with
 *   `finish_reason: "stop"`.
 * - `tool-call-pending` → flush pending text, emit the tool call as
 *   `delta.tool_calls`, then terminate with `finish_reason: "tool_calls"`.
 * - `message-incomplete` → on a provider error, the terminal
 *   {@link OpenAIStreamError} envelope; otherwise a terminal chunk with
 *   `finish_reason: "length"` when the provider hit the token cap, else
 *   `"stop"` (e.g. a user cancellation).
 *
 * `user-message-stored` and `thread-title` carry no completion payload and
 * are skipped. The terminal `[DONE]` sentinel is an SSE-transport concern and
 * is left to the caller.
 */
export async function* toOpenAIChatCompletionStream(
  events: AsyncGenerator<ChatEvent>,
  opts: ToOpenAIStreamOptions
): AsyncGenerator<OpenAIStreamChunk> {
  const created = opts.created ?? Math.floor(Date.now() / 1000);
  let id = opts.id;
  let roleSent = false;
  let prevText = "";

  const chunk = (
    delta: OpenAIChoiceDelta,
    finishReason: OpenAIFinishReason
  ): OpenAIChatCompletionChunk => ({
    id: id ?? "chatcmpl-stream",
    object: "chat.completion.chunk",
    created,
    model: opts.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });

  for await (const event of events) {
    if (
      event.type === "user-message-stored" ||
      event.type === "thread-title"
    ) {
      continue;
    }

    if (!id && "messageId" in event && event.messageId) {
      id = `chatcmpl-${event.messageId}`;
    }

    if (event.type === "message-incomplete") {
      const status = event.message.status as
        | { reason?: string; error?: ChatErrorPayload }
        | undefined;
      // A provider error surfaces as the OpenAI error envelope, not a
      // `finish_reason: "stop"` chunk that would read as success.
      if (status?.reason === "error") {
        yield toOpenAIError(status.error);
        return;
      }
      yield chunk({}, status?.reason === "length" ? "length" : "stop");
      return;
    }

    const fullText = extractText(event.message.content);
    const delta = textDelta(prevText, fullText);
    prevText = fullText;

    const contentDelta: OpenAIChoiceDelta = {};
    if (!roleSent) {
      contentDelta.role = "assistant";
      roleSent = true;
    }
    if (delta.length > 0) contentDelta.content = delta;

    if (event.type === "tool-call-pending") {
      // Flush any text that accompanied the tool call before the call itself.
      if (contentDelta.role || contentDelta.content !== undefined) {
        yield chunk(contentDelta, null);
      }
      const toolCall = readToolCall(event.message, event.idx);
      if (toolCall) {
        const args =
          typeof toolCall.argsText === "string"
            ? toolCall.argsText
            : JSON.stringify(toolCall.args ?? {});
        yield chunk(
          {
            tool_calls: [
              {
                index: 0,
                id: toolCall.toolCallId ?? id ?? "tool-call",
                type: "function",
                function: { name: toolCall.toolName, arguments: args },
              },
            ],
          },
          "tool_calls"
        );
      } else {
        yield chunk({}, "tool_calls");
      }
      return;
    }

    // message-start | message-delta — emit only when there's something new.
    if (contentDelta.role || contentDelta.content !== undefined) {
      yield chunk(contentDelta, null);
    }

    if (event.type === "message-end") {
      yield chunk({}, "stop");
      return;
    }
  }
}
