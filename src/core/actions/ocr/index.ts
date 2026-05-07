import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  isFallbackProfile,
  transformHistoryToText,
} from "../chat/fallback-tools";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt } from "./prompt";

export const recognizeText = async (
  args: ActionArgs
): Promise<ThreadMessageLike> => {
  const messages = isFallbackProfile(args.profile)
    ? transformHistoryToText(args.messages)
    : args.messages;
  const text = await providerFor(args).sendMessageSync({
    messages,
    model: args.profile.modelId,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    signal: args.signal,
  });
  return { role: "assistant", content: [{ type: "text", text }] };
};
