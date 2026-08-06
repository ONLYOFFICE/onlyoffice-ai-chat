import type { SendMessageResult } from "../../../shared/send-message-args";
import { augmentToolsWithIntent } from "../../../shared/tool-intent";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { isFallbackProfile, streamWithTextProtocol } from "./fallback-tools";
import { systemPrompt } from "./prompt";

/**
 * Streaming chat action — yields every delta as the provider produces it.
 * The only action that exposes a stream; the rest are one-shot via
 * `sendMessageSync`.
 *
 * When `profile.canUseTool === false` and tools are present, falls back to
 * a text-protocol implementation that injects tool descriptions into the
 * system prompt and parses `<TOOL_CALL>...</TOOL_CALL>` blocks out of the
 * model's plain-text response.
 */
export async function* chat(
  args: ActionArgs
): AsyncGenerator<SendMessageResult> {
  const baseSystem = resolveSystemPrompt(systemPrompt, args.prompt);

  if (isFallbackProfile(args.profile) && (args.tools?.length ?? 0) > 0) {
    yield* streamWithTextProtocol(args, baseSystem);
    return;
  }

  const provider = await providerFor(args);
  yield* provider.sendMessage({
    messages: args.messages,
    model: args.profile.modelId,
    systemPrompt: baseSystem,
    tools: args.tools ? augmentToolsWithIntent(args.tools) : args.tools,
    withReasoning: args.isReasoning,
    useResponsesApi: args.profile.useResponsesApi === true,
    signal: args.signal,
  });
}
