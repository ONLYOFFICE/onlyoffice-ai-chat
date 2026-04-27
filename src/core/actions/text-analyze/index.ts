import type { ThreadMessageLike } from "@assistant-ui/react";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt } from "./prompt";

export const analyzeText = async (
  args: ActionArgs
): Promise<ThreadMessageLike> => {
  const text = await providerFor(args).sendMessageSync({
    messages: args.messages,
    model: args.profile.modelId,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    signal: args.signal,
  });
  return { role: "assistant", content: [{ type: "text", text }] };
};
