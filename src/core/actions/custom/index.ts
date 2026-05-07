import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../shared/send-message-args";
import {
  isFallbackProfile,
  streamWithTextProtocol,
  transformHistoryToText,
} from "../chat/fallback-tools";
import { providerFor } from "../provider";
import type { ActionArgs } from "../types";

/**
 * Args for the `custom` action — `ActionArgs` plus an explicit
 * `systemPrompt`. Unlike the other actions, the prompt is not baked in;
 * the caller supplies it at runtime.
 */
export type CustomArgs = ActionArgs & { systemPrompt: string };

/** Streaming custom-prompt action — caller iterates the generator. */
export const custom = (args: CustomArgs): AsyncGenerator<SendMessageResult> => {
  if (isFallbackProfile(args.profile) && (args.tools?.length ?? 0) > 0) {
    return streamWithTextProtocol(args, args.systemPrompt);
  }

  return providerFor(args).sendMessage({
    messages: args.messages,
    model: args.profile.modelId,
    systemPrompt: args.systemPrompt,
    tools: args.tools,
    withReasoning: args.isReasoning,
    signal: args.signal,
  });
};

/** One-shot custom-prompt action — caller awaits a single message. */
export const customSync = async (
  args: CustomArgs
): Promise<ThreadMessageLike> => {
  const messages = isFallbackProfile(args.profile)
    ? transformHistoryToText(args.messages)
    : args.messages;
  const text = await providerFor(args).sendMessageSync({
    messages,
    model: args.profile.modelId,
    systemPrompt: args.systemPrompt,
    signal: args.signal,
  });
  return { role: "assistant", content: [{ type: "text", text }] };
};
