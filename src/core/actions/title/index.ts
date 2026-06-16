import {
  isFallbackProfile,
  transformHistoryToText,
} from "../chat/fallback-tools";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt } from "./prompt";

/**
 * One-shot call on the given profile to produce a short thread title from
 * the supplied user message. Uses the provider's `sendMessageSync` method —
 * no streaming, no persistence, just a trimmed string. Empty if the model
 * returns nothing; callers decide their own fallback.
 */
export const generateTitle = async (args: ActionArgs): Promise<string> => {
  const messages = isFallbackProfile(args.profile)
    ? transformHistoryToText(args.messages)
    : args.messages;
  const title = await providerFor(args).sendMessageSync({
    messages,
    model: args.profile.modelId,
    useResponsesApi: args.profile.useResponsesApi === true,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    signal: args.signal,
  });
  return title.trim();
};
