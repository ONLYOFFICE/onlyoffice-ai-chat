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

/**
 * Shortest prefix that may end a truncated title on a word boundary. Below
 * it the last space sits too far from the limit to be worth honoring (a
 * title with no spaces at all, or one long leading token), so the cut lands
 * mid-word instead of throwing most of the title away.
 */
const WORD_BOUNDARY_FLOOR = Math.floor(MAX_TITLE_LENGTH * 0.6);

/**
 * Collapse model output into something usable as a title: a single line, no
 * longer than {@link MAX_TITLE_LENGTH}. An over-long value is truncated on
 * a word boundary where one is close enough to the limit, and marked with an
 * ellipsis; the result never exceeds the limit, ellipsis included.
 */
export const normalizeTitle = (raw: string): string => {
  // Also folds newlines: a title renders on one line, and the leading
  // "Here is a title:\n…" preamble the prompt forbids arrives as one.
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_TITLE_LENGTH) {
    return collapsed;
  }
  // One character is reserved for the ellipsis.
  const cut = collapsed.slice(0, MAX_TITLE_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace >= WORD_BOUNDARY_FLOOR ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}…`;
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
