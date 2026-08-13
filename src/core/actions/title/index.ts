import {
  isFallbackProfile,
  transformHistoryToText,
} from "../chat/fallback-tools";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt } from "./prompt";

/**
 * Hard ceiling on a generated title. The system prompt asks for "under 60
 * characters", but that is a request, and a weak model happily ignores it —
 * returning a preamble, a multi-line list, or the entire answer. The title
 * is persisted (hosts commonly back it with a bounded column — DocSpace
 * uses `varchar(255)`) and rendered in a single-line list row, so the limit
 * has to be enforced in code. Twice the requested length: a model that
 * overshoots slightly keeps its title intact, one that returns prose is cut.
 */
const MAX_TITLE_LENGTH = 120;

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;

/**
 * Collapse model output into something usable as a title: a single line, no
 * longer than {@link MAX_TITLE_LENGTH}. An over-long value is cut on the last
 * word boundary that fits and marked with an ellipsis; the result never
 * exceeds the limit, ellipsis included.
 */
export const normalizeTitle = (raw: string): string => {
  // Also folds newlines: a title renders on one line, and the leading
  // "Here is a title:\n..." preamble the prompt forbids arrives as one.
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_TITLE_LENGTH) {
    return collapsed;
  }

  // One character is reserved for the ellipsis.
  const cut = collapsed.slice(0, MAX_TITLE_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) {
    // Stops on the character before the space, so no trailing space is left
    // (whitespace above is already collapsed to single spaces).
    return `${cut.slice(0, lastSpace)}…`;
  }

  // Spaceless text — CJK, a URL, a base64 blob — offers no boundary, so the
  // cut lands mid-token. Back off one code unit when it would split a
  // surrogate pair: a lone surrogate is not valid UTF-8 and gets rejected or
  // mangled on the way into storage.
  const end = isHighSurrogate(cut.charCodeAt(cut.length - 1))
    ? cut.length - 1
    : cut.length;

  return `${cut.slice(0, end)}…`;
};

/**
 * One-shot call on the given profile to produce a short thread title from
 * the supplied user message. Uses the provider's `sendMessageSync` method —
 * no streaming, no persistence, just a normalized single-line string capped
 * at {@link MAX_TITLE_LENGTH}. Empty if the model returns nothing; callers
 * decide their own fallback.
 */
export const generateTitle = async (args: ActionArgs): Promise<string> => {
  const messages = isFallbackProfile(args.profile)
    ? transformHistoryToText(args.messages)
    : args.messages;
  const title = await (await providerFor(args)).sendMessageSync({
    messages,
    model: args.profile.modelId,
    useResponsesApi: args.profile.useResponsesApi === true,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    withReasoning: args.isReasoning,
    signal: args.signal,
  });
  return normalizeTitle(title);
};
