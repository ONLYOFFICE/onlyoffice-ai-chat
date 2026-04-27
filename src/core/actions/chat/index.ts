import type { SendMessageResult } from "../../../shared/send-message-args";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt } from "./prompt";

/**
 * Streaming chat action — yields every delta as the provider produces it.
 * The only action that exposes a stream; the rest are one-shot via
 * `sendMessageSync`.
 */
export const chat = (args: ActionArgs): AsyncGenerator<SendMessageResult> =>
  providerFor(args).sendMessage({
    messages: args.messages,
    model: args.profile.modelId,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    tools: args.tools,
    withReasoning: args.isReasoning,
    signal: args.signal,
  });
