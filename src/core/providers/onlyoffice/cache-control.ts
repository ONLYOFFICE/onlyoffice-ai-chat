import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Anthropic-style prompt-caching marker. The ONLYOFFICE AI route proxies
 * to Claude behind an OpenAI-compatible facade, so the marker travels as
 * an extra field on individual content blocks — it is not part of the
 * OpenAI wire format and therefore absent from the SDK's types.
 */
const EPHEMERAL = { type: "ephemeral" } as const;

/** A text content block carrying the caching marker. */
type CacheableTextPart = {
  type: "text";
  text: string;
  cache_control?: typeof EPHEMERAL;
};

/** Loose view of a converted message, before the marker is attached. */
type LooseMessage = {
  role: string;
  content: string | CacheableTextPart[] | Record<string, unknown>[];
};

/**
 * Attach the marker to a message's trailing text block, normalising a
 * plain-string `content` into a one-element block array on the way. An
 * empty string is left untouched — a blank cached block is rejected
 * upstream, and there is nothing worth caching in it anyway.
 *
 * Non-text trailing blocks (images, files) are skipped in favour of the
 * last text block; a message with no text block at all is returned as is.
 *
 * @param message - One already-converted chat-completion message.
 * @returns A copy carrying the marker, or the original when inapplicable.
 */
const markMessage = (message: LooseMessage): LooseMessage => {
  if (typeof message.content === "string") {
    if (!message.content) return message;
    const part: CacheableTextPart = {
      type: "text",
      text: message.content,
      cache_control: EPHEMERAL,
    };
    return { ...message, content: [part] };
  }

  if (!Array.isArray(message.content)) return message;

  // Manual reverse scan: `findLastIndex` needs an ES2023 lib.
  let index = -1;
  for (let i = message.content.length - 1; i >= 0; i--) {
    if ((message.content[i] as CacheableTextPart).type === "text") {
      index = i;
      break;
    }
  }
  if (index === -1) return message;

  const content = message.content.map((part, i) =>
    i === index ? { ...part, cache_control: EPHEMERAL } : part
  );
  return { ...message, content } as LooseMessage;
};

/**
 * Place prompt-caching breakpoints on an outgoing chat-completion
 * request.
 *
 * Two breakpoints are used out of the four Anthropic allows:
 *
 *  1. the leading `system` message — the large static prefix (system
 *     prompt, instructions) shared by every turn of every thread;
 *  2. the final message of the conversation — so the whole history up to
 *     the current turn is cached and the next turn reuses it.
 *
 * Both are pure additions to the request body: a backend that ignores
 * `cache_control` sees an otherwise unchanged request.
 *
 * @param messages - Messages as produced by the OpenAI converters.
 * @returns A new array with the markers attached; the input is untouched.
 */
export const withCacheControl = (
  messages: ChatCompletionMessageParam[]
): ChatCompletionMessageParam[] => {
  if (messages.length === 0) return messages;

  const loose = messages as unknown as LooseMessage[];
  const last = loose.length - 1;

  const result = loose.map((message, i) => {
    if (i === last) return markMessage(message);
    if (i === 0 && message.role === "system") return markMessage(message);
    return message;
  });

  return result as unknown as ChatCompletionMessageParam[];
};
