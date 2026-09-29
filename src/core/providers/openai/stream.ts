import type {
  ReasoningMessagePart,
  ThreadMessageLike,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { toChatError } from "../../services/ai/error";
import { InlineReasoningSplitter } from "./inline-reasoning";

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
  reasoning_details?: unknown;
  images?: unknown;
};

/**
 * Concatenate the readable fragments of an OpenRouter-style
 * `reasoning_details` array. Entries are tagged objects: `reasoning.text`
 * carries `text`, `reasoning.summary` carries `summary` (what OpenRouter
 * returns for Claude, which it summarizes by default), and
 * `reasoning.encrypted` carries opaque `data` that is deliberately skipped —
 * it is not human-readable and belongs nowhere near the transcript.
 *
 * @param details - The delta's `reasoning_details` value, of unknown shape.
 * @returns The joined fragment, or `undefined` when nothing readable is in it.
 */
const readReasoningDetails = (details: unknown): string | undefined => {
  if (!Array.isArray(details)) return undefined;
  let text = "";
  for (const entry of details) {
    if (!entry || typeof entry !== "object") continue;
    const detail = entry as { text?: unknown; summary?: unknown };
    if (typeof detail.text === "string") text += detail.text;
    else if (typeof detail.summary === "string") text += detail.summary;
  }
  return text || undefined;
};

/**
 * Pull the thinking fragment out of a delta, whichever field carries it.
 * Three spellings are in the wild and a backend picks one:
 * `reasoning_content` (DeepSeek R1, ONLYOFFICE `-thinking` variants),
 * a string `reasoning` (OpenRouter's backwards-compatible field and the
 * gateways that copy it), and OpenRouter's structured `reasoning_details`
 * — the only one its Anthropic route fills, so reading just the first two
 * left a Claude round with no visible thinking at all.
 *
 * They are read in that order, so a backend sending several never
 * double-counts the same fragment. A non-string `reasoning` is still never
 * stringified into the transcript.
 *
 * @param delta - One streaming delta.
 * @returns The fragment, or `undefined` when the delta carries none.
 */
export const readReasoningDelta = (
  delta: DeltaWithReasoning
): string | undefined => {
  if (delta.reasoning_content) return delta.reasoning_content;
  if (typeof delta.reasoning === "string" && delta.reasoning) {
    return delta.reasoning;
  }
  return readReasoningDetails(delta.reasoning_details);
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
): ThreadMessageLike => appendText(responseMessage, chunk.delta.content ?? "");

/**
 * Append a text fragment that has already been separated from the chunk.
 * Shared by {@link handleText} and the inline-reasoning path, which emits
 * only the answer half of a delta and so has no chunk to hand over.
 *
 * @param responseMessage - The accumulating response.
 * @param delta           - The answer text to append.
 * @returns The updated response message.
 */
export const appendText = (
  responseMessage: ThreadMessageLike,
  delta: string
): ThreadMessageLike => {
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
// Image delta handler
// ---------------------------------------------------------------------------

/**
 * Pull image URLs out of a delta's `images` array.
 *
 * Image-output models (Gemini 3 Pro Image, `gpt-4o-image`) return their
 * pictures through `/chat/completions` rather than an images endpoint,
 * as `message.images[*].image_url.url` — a `data:` URI or an http(s)
 * link. The field is OpenRouter's extension to the OpenAI shape, so it
 * is read defensively: anything that is not a non-empty string url is
 * skipped.
 *
 * @param images - The delta's `images` value, of unknown shape.
 * @returns Every url found, in order; empty when the delta carries none.
 */
export const readImageDeltas = (images: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  const urls: string[] = [];
  for (const entry of images) {
    if (!entry || typeof entry !== "object") continue;
    const url = (entry as { image_url?: { url?: unknown } }).image_url?.url;
    if (typeof url === "string" && url) urls.push(url);
  }
  return urls;
};

/**
 * Append an `image` part for each url the delta carried.
 *
 * Images are always pushed as their own parts rather than merged into a
 * neighbour — unlike text, two images are two pictures, never one split
 * across deltas.
 *
 * @param responseMessage - The accumulating response.
 * @param urls            - Urls from {@link readImageDeltas}.
 * @returns The updated response message.
 */
export const handleImages = (
  responseMessage: ThreadMessageLike,
  urls: string[]
): ThreadMessageLike => {
  if (!urls.length) return responseMessage;
  if (!Array.isArray(responseMessage.content)) return responseMessage;

  const content = [...responseMessage.content];
  for (const url of urls) {
    content.push({ type: "image", image: url });
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

/** Per-request switches for {@link processStream}. */
export interface ProcessStreamOptions {
  /**
   * Route thinking that a backend emits inside `delta.content` — Qwen3's
   * `<think>` spans, gpt-oss's harmony channels — into reasoning parts
   * instead of answer text. Opt-in: only the local-model providers see
   * backends that do this, and a hosted model writing `<think>` in a reply
   * about prompt formats means it literally (Bug 83793).
   */
  splitInlineReasoning?: boolean;
}

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
  signal?: AbortSignal,
  options: ProcessStreamOptions = {}
): AsyncGenerator<SendMessageResult> {
  let responseMessage: ThreadMessageLike = createEmptyResponse();
  let isStreamComplete = false;
  let hasUnfinalizedReasoning = false;
  const splitter = options.splitInlineReasoning
    ? new InlineReasoningSplitter()
    : undefined;

  for await (const streamEvent of stream) {
    // The caller hung up mid-reply. The SDK may keep the iterator alive for
    // a moment (or close it without throwing) — stop here and report a
    // cancellation, never a finished reply (DocSpace bug 84028).
    if (signal?.aborted && !isStreamComplete) {
      yield { isEnd: true, responseMessage: createStopResponse() };
      return;
    }
    const prev = responseMessage;
    for (const chunk of streamEvent.choices) {
      if (isStreamComplete) break;

      const delta = chunk.delta as DeltaWithReasoning;

      if (chunk.finish_reason) {
        // Release any tail the splitter withheld as a possible partial
        // marker before the message is finalized.
        const tail = splitter?.flush();
        if (tail?.reasoning) {
          hasUnfinalizedReasoning = true;
          responseMessage = handleReasoning(responseMessage, tail.reasoning);
        }
        if (tail?.text) {
          if (hasUnfinalizedReasoning) {
            responseMessage = finalizeReasoning(responseMessage);
            hasUnfinalizedReasoning = false;
          }
          responseMessage = appendText(responseMessage, tail.text);
        }
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
        // With the splitter on, one content delta can carry both halves:
        // the text that closed the thinking span and the answer after it.
        const split = splitter
          ? splitter.push(delta.content)
          : { text: delta.content, reasoning: "" };

        if (split.reasoning) {
          hasUnfinalizedReasoning = true;
          responseMessage = handleReasoning(responseMessage, split.reasoning);
        }

        if (split.text) {
          if (hasUnfinalizedReasoning) {
            responseMessage = finalizeReasoning(responseMessage);
            hasUnfinalizedReasoning = false;
          }
          responseMessage = appendText(responseMessage, split.text);
        }
      }

      // Image-output models emit the picture alongside their reasoning; the
      // thinking is closed off first so the image is not appended into the
      // reasoning transcript.
      const imageDeltas = readImageDeltas(delta.images);
      if (imageDeltas.length) {
        if (hasUnfinalizedReasoning) {
          responseMessage = finalizeReasoning(responseMessage);
          hasUnfinalizedReasoning = false;
        }
        responseMessage = handleImages(responseMessage, imageDeltas);
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

  // Stream closed without a `finish_reason` — salvage whatever we got,
  // including anything the splitter was still holding back.
  const tail = splitter?.flush();
  if (tail?.reasoning) {
    hasUnfinalizedReasoning = true;
    responseMessage = handleReasoning(responseMessage, tail.reasoning);
  }
  if (tail?.text) {
    if (hasUnfinalizedReasoning) {
      responseMessage = finalizeReasoning(responseMessage);
      hasUnfinalizedReasoning = false;
    }
    responseMessage = appendText(responseMessage, tail.text);
  }
  if (hasUnfinalizedReasoning) {
    responseMessage = finalizeReasoning(responseMessage, true);
  }

  const hasContent =
    typeof responseMessage.content === "string"
      ? responseMessage.content.length > 0
      : responseMessage.content.length > 0;

  if (signal?.aborted && !isStreamComplete) {
    // User stopped — the SDK closes the iterator without throwing, so the
    // end of the stream is a cancellation whether or not text had already
    // arrived. Checked before `hasContent`: a partial reply that ended here
    // used to be reported as a finished one, and was persisted with no
    // status at all (DocSpace bug 84028).
    yield { isEnd: true, responseMessage: createStopResponse() };
  } else if (hasContent) {
    yield { isEnd: true, responseMessage };
  } else {
    yield {
      isEnd: true,
      responseMessage: createErrorResponse(
        new Error("Stream ended unexpectedly without response")
      ),
    };
  }
}
