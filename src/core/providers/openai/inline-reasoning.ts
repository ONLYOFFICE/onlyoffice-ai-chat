/**
 * Inline-reasoning splitter for OpenAI-compatible local backends.
 *
 * Ollama, LM Studio and the other llama.cpp-style servers expose
 * `/v1/chat/completions`, but their chat templates don't split the model's
 * thinking into the non-standard `reasoning_content` field the way DeepSeek
 * and the hosted gateways do. Qwen3 and DeepSeek-R1 distills emit it inline
 * as `<think>…</think>`, and gpt-oss leaks the raw harmony channel markers
 * (`<|channel|>analysis<|message|>…<|start|>assistant<|channel|>final`) —
 * all of it inside `delta.content`.
 *
 * {@link processStream} can only route what a delta labels as reasoning, so
 * without this splitter the thinking lands in a `text` part: it renders as
 * the answer, goes back to the model as its own prior answer, and — the
 * reported symptom (Bug 83793) — gets copied into the `content` argument of
 * a document-writing tool, so the model's deliberation is inserted into the
 * user's document.
 *
 * The parser is incremental because the markers are split across chunks at
 * arbitrary offsets: `<thi` + `nk>` is the common case, and the harmony
 * markers are long enough to straddle several deltas. It therefore holds
 * back any tail that could still grow into a marker and emits it once the
 * next chunk resolves the ambiguity.
 */

/** One delta split into its answer and thinking halves. */
export interface SplitDelta {
  /** Text belonging to the answer; `""` when the chunk was pure thinking. */
  text: string;
  /** Text belonging to the thinking transcript; `""` when there was none. */
  reasoning: string;
}

/** A tag pair that wraps inline thinking in the content stream. */
interface TagPair {
  open: string;
  close: string;
}

/**
 * Tag pairs recognised on the local-backend path.
 *
 * `<think>` covers Qwen3, the DeepSeek-R1 distills and most llama.cpp
 * reasoning templates; `<reasoning>` covers the fine-tunes and community
 * builds that picked the longer spelling.
 */
const TAG_PAIRS: readonly TagPair[] = [
  { open: "<think>", close: "</think>" },
  { open: "<reasoning>", close: "</reasoning>" },
];

/**
 * gpt-oss harmony markers. The model addresses a *channel* rather than
 * wrapping a span: `analysis` (and `commentary`) carry deliberation, `final`
 * carries the answer. A channel header runs up to the `<|message|>` that
 * starts its body, and the body runs until the next `<|start|>` / `<|end|>` /
 * `<|channel|>` marker.
 */
const HARMONY_CHANNEL = "<|channel|>";
const HARMONY_MESSAGE = "<|message|>";
const HARMONY_START = "<|start|>";
const HARMONY_END = "<|end|>";
const HARMONY_RETURN = "<|return|>";

/** Harmony channel names whose body is deliberation, not the answer. */
const HARMONY_THINKING_CHANNELS = ["analysis", "commentary"];

/**
 * Every literal that must never be emitted half-written, longest first.
 * A trailing fragment of any of these is held back until the next chunk
 * proves whether it was a real marker or ordinary text.
 */
const ALL_MARKERS: readonly string[] = [
  ...TAG_PAIRS.flatMap((pair) => [pair.open, pair.close]),
  HARMONY_CHANNEL,
  HARMONY_MESSAGE,
  HARMONY_START,
  HARMONY_END,
  HARMONY_RETURN,
];

/**
 * Length of the longest suffix of `buffer` that is a proper prefix of any
 * marker. That suffix might be the first half of a marker split across
 * chunks, so it is withheld rather than emitted.
 *
 * @param buffer - Text left after every complete marker was consumed.
 * @returns How many trailing characters to hold back.
 */
const pendingMarkerLength = (buffer: string): number => {
  const max = Math.min(
    buffer.length,
    Math.max(...ALL_MARKERS.map((marker) => marker.length)) - 1
  );
  for (let len = max; len > 0; len--) {
    const tail = buffer.slice(buffer.length - len);
    if (ALL_MARKERS.some((marker) => marker.startsWith(tail))) return len;
  }
  return 0;
};

/**
 * Incremental splitter for one response stream.
 *
 * Construct one per request and feed it every `delta.content` fragment in
 * order; it returns the answer and thinking halves of that fragment. Call
 * {@link flush} once the stream ends to release any withheld tail.
 */
export class InlineReasoningSplitter {
  /** Text carried over from the previous chunk (a partial marker). */
  private buffer = "";

  /** Nesting depth of the active `<think>` / `<reasoning>` span. */
  private depth = 0;

  /** The tag pair that opened the active span, if any. */
  private activeTag: TagPair | undefined;

  /**
   * Whether the harmony channel currently being read is a thinking one.
   * `undefined` when no harmony channel is active.
   */
  private harmonyThinking: boolean | undefined;

  /** Whether a harmony channel header is still being read (pre-`<|message|>`). */
  private inHarmonyHeader = false;

  /** Channel name accumulated while {@link inHarmonyHeader} is true. */
  private pendingChannelName = "";

  /**
   * Whether any harmony marker has been seen. Once the stream is known to
   * speak harmony, text outside a recognised channel is treated as answer
   * text only when a `final` channel has been opened — before the first
   * channel header, gpt-oss emits nothing the user should see.
   */
  private sawHarmony = false;

  /**
   * Split one content fragment.
   *
   * @param chunk - The raw `delta.content` fragment.
   * @returns The answer and thinking halves; either may be `""`.
   */
  push(chunk: string): SplitDelta {
    this.buffer += chunk;

    let text = "";
    let reasoning = "";

    // Consume the buffer marker by marker. Each iteration either resolves
    // one complete marker or emits the plain run in front of it.
    for (;;) {
      const marker = this.nextMarker();

      if (!marker) {
        // No complete marker left: emit everything except a tail that could
        // still grow into one.
        const hold = pendingMarkerLength(this.buffer);
        const emit = this.buffer.slice(0, this.buffer.length - hold);
        this.buffer = this.buffer.slice(this.buffer.length - hold);
        if (emit) {
          if (this.inHarmonyHeader) this.pendingChannelName += emit;
          else if (this.isThinking()) reasoning += emit;
          else if (this.isAnswer()) text += emit;
        }
        break;
      }

      const before = this.buffer.slice(0, marker.index);
      if (before) {
        if (this.inHarmonyHeader) this.pendingChannelName += before;
        else if (this.isThinking()) reasoning += before;
        else if (this.isAnswer()) text += before;
      }

      this.buffer = this.buffer.slice(marker.index + marker.literal.length);
      this.applyMarker(marker.literal);
    }

    return { text, reasoning };
  }

  /**
   * Release whatever is still buffered at end of stream. A tail that looked
   * like the start of a marker but never completed is ordinary text and must
   * not be swallowed.
   *
   * @returns The final answer and thinking halves.
   */
  flush(): SplitDelta {
    const rest = this.buffer;
    this.buffer = "";
    if (!rest) return { text: "", reasoning: "" };
    if (this.isThinking()) return { text: "", reasoning: rest };
    if (this.isAnswer()) return { text: rest, reasoning: "" };
    return { text: "", reasoning: "" };
  }

  /** Whether the parser is inside a thinking span or channel. */
  private isThinking(): boolean {
    if (this.inHarmonyHeader) return false;
    if (this.depth > 0) return true;
    return this.harmonyThinking === true;
  }

  /**
   * Whether text at the current position belongs to the answer. Harmony
   * streams suppress anything outside an explicit channel body, since the
   * preamble between markers is protocol scaffolding rather than content.
   */
  private isAnswer(): boolean {
    if (this.inHarmonyHeader) return false;
    if (this.depth > 0) return false;
    if (this.harmonyThinking === true) return false;
    if (this.harmonyThinking === false) return true;
    return !this.sawHarmony;
  }

  /**
   * Find the first complete marker in the buffer that is meaningful in the
   * current state — a close tag is only a marker while its span is open.
   */
  private nextMarker(): { index: number; literal: string } | undefined {
    let best: { index: number; literal: string } | undefined;

    const consider = (literal: string) => {
      const index = this.buffer.indexOf(literal);
      if (index === -1) return;
      // Earliest wins; on a tie the longer literal wins so `<|channel|>`
      // is never mistaken for a shorter overlapping marker.
      if (
        !best ||
        index < best.index ||
        (index === best.index && literal.length > best.literal.length)
      ) {
        best = { index, literal };
      }
    };

    if (this.inHarmonyHeader) {
      consider(HARMONY_MESSAGE);
    } else if (this.depth > 0 && this.activeTag) {
      // Inside a tag span only its own delimiters matter, so a stray
      // `<|channel|>` inside quoted thinking can't derail the parse.
      consider(this.activeTag.open);
      consider(this.activeTag.close);
    } else {
      for (const pair of TAG_PAIRS) consider(pair.open);
      consider(HARMONY_CHANNEL);
      consider(HARMONY_START);
      consider(HARMONY_END);
      consider(HARMONY_RETURN);
    }

    return best;
  }

  /** Advance the state machine past one complete marker. */
  private applyMarker(literal: string): void {
    if (literal === HARMONY_MESSAGE) {
      // The header between `<|channel|>` and here names the channel; the
      // model may append role/format metadata after it, so match on the
      // leading word only.
      const name = this.pendingChannelName.trim().toLowerCase();
      this.harmonyThinking = HARMONY_THINKING_CHANNELS.some(
        (channel) => name === channel || name.startsWith(`${channel} `)
      );
      this.pendingChannelName = "";
      this.inHarmonyHeader = false;
      return;
    }

    if (literal === HARMONY_CHANNEL) {
      this.sawHarmony = true;
      this.inHarmonyHeader = true;
      // The channel name sits between this marker and `<|message|>`; decide
      // from it once it has fully arrived.
      this.harmonyThinking = undefined;
      this.pendingChannelName = "";
      return;
    }

    if (
      literal === HARMONY_START ||
      literal === HARMONY_END ||
      literal === HARMONY_RETURN
    ) {
      this.sawHarmony = true;
      this.harmonyThinking = undefined;
      this.inHarmonyHeader = false;
      return;
    }

    const opening = TAG_PAIRS.find((pair) => pair.open === literal);
    if (opening) {
      if (this.depth === 0) this.activeTag = opening;
      this.depth += 1;
      return;
    }

    const closing = TAG_PAIRS.find((pair) => pair.close === literal);
    if (closing) {
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) this.activeTag = undefined;
    }
  }
}

/**
 * Drop inline thinking from a complete, non-streamed response body.
 *
 * The one-shot path (`sendMessageSync`, used by title generation and the
 * action layer) reads `choices[0].message.content` directly, so it needs the
 * same treatment as the stream — a title built from a `<think>` preamble is
 * the same leak in a smaller place.
 *
 * @param content - The full assistant message content.
 * @returns The answer text, trimmed of the thinking spans.
 */
export const stripInlineReasoning = (content: string): string => {
  if (!content) return content;
  const splitter = new InlineReasoningSplitter();
  const first = splitter.push(content);
  const rest = splitter.flush();
  return (first.text + rest.text).trim();
};
