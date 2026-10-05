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

/** One entry of a streaming `delta.tool_calls` array. */
type ToolCallDelta = NonNullable<
  ChatCompletionChunk.Choice["delta"]["tool_calls"]
>[number];

/**
 * Positions of in-progress tool-call parts inside `message.content`,
 * keyed by the delta's `index`. One map lives for the duration of a
 * single stream — parallel calls arrive interleaved and each fragment
 * says which call it extends only through that number.
 */
export type ToolCallSlots = Map<number, number>;

/**
 * Create an empty `tool-call` part. Every field is filled in by
 * {@link mergeToolCall}, starting with the delta that opened the call.
 */
const createToolCallPart = (): ToolCallMessagePart =>
  ({
    type: "tool-call",
    args: {},
    argsText: "",
    toolName: "",
    toolCallId: "",
  }) as ToolCallMessagePart;

/**
 * Merge an incoming tool-call delta into the in-progress part. Tool-call
 * arguments stream in as a concatenation of JSON fragments — we keep the
 * raw `argsText` and opportunistically try to parse `args` whenever the
 * accumulated fragment is valid JSON.
 */
const mergeToolCall = (
  existing: ToolCallMessagePart,
  update?: ToolCallDelta
): ToolCallMessagePart => {
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
 * Whether a delta may extend `part`, judged by ids alone. A fragment that
 * names a different, non-empty id belongs to another call even if it
 * arrives under the same `index` — some backends restart numbering at
 * zero for every call they emit.
 */
const sameCall = (part: ToolCallMessagePart, update: ToolCallDelta): boolean =>
  !update.id || !part.toolCallId || update.id === part.toolCallId;

/**
 * Append or extend tool-call parts from a streaming delta.
 *
 * Every entry of `delta.tool_calls` is routed by its `index`, the field
 * the OpenAI format uses to tell parallel calls apart: a known index
 * extends the part it was first seen on, a new one opens a new part.
 * Routing by "the last part is a tool-call" used to glue a second call's
 * arguments onto the first (`{"query":"A"}{"query":"B"}`), lose the
 * second call entirely, and poison the transcript with invalid JSON that
 * the next request was rejected for (Bug 84216). `parallel_tool_calls:
 * false` is still sent, but OpenRouter routes and local servers ignore it.
 *
 * Without an `index` the delta falls back to id matching against the last
 * part, which is also what keeps a lone fragment with neither id nor index
 * flowing into the call in progress.
 *
 * @param responseMessage - The accumulating response.
 * @param chunk           - The streaming choice carrying the tool-call delta.
 * @param slots           - Index → content-position map for this stream.
 *   Callers that only ever feed one call may omit it.
 * @returns The updated response message.
 */
export const handleToolCall = (
  responseMessage: ThreadMessageLike,
  chunk: ChatCompletionChunk.Choice,
  slots: ToolCallSlots = new Map()
): ThreadMessageLike => {
  const updates = chunk.delta.tool_calls;
  if (!updates?.length || !Array.isArray(responseMessage.content)) {
    return responseMessage;
  }

  const content = [...responseMessage.content];

  for (const update of updates) {
    if (!update) continue;
    const index = typeof update.index === "number" ? update.index : undefined;

    let pos = index === undefined ? -1 : (slots.get(index) ?? -1);
    // No slot to route by: an index-less delta, or an index this map has
    // not seen while the fragment carries neither id nor name. The first
    // fragment of a call always names it, so a bare fragment can only be
    // continuing the call in progress.
    const isBareFragment = !update.id && !update.function?.name;
    if (pos === -1 && (index === undefined || isBareFragment)) {
      pos = content.length - 1;
    }

    const target = pos >= 0 ? content[pos] : undefined;
    if (target && target.type === "tool-call" && sameCall(target, update)) {
      content[pos] = mergeToolCall(target, update);
      if (index !== undefined) slots.set(index, pos);
      continue;
    }

    // Run the opening fragment through the merge so arguments that arrive
    // whole in the first delta are parsed right away.
    content.push(mergeToolCall(createToolCallPart(), update));
    if (index !== undefined) slots.set(index, content.length - 1);
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
  const toolCallSlots: ToolCallSlots = new Map();

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
        responseMessage = handleToolCall(responseMessage, chunk, toolCallSlots);
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
