import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  isFallbackProfile,
  transformHistoryToText,
} from "../chat/fallback-tools";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt } from "./prompt";

/**
 * Pull the latest user-authored prompt out of the thread. Used as the
 * single-string input that image-generation APIs (DALL·E, Stability AI)
 * expect — they do not consume conversation history.
 */
const extractPrompt = (messages: ThreadMessageLike[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    const text = message.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
};

/**
 * Generate an image for the given profile.
 *
 * Prefers the provider's native `imageGeneration` method (DALL·E,
 * Stability AI, etc.) when available — the result is wrapped as an
 * `image` content part with a base64 data URL. Falls back to
 * `sendMessageSync` when the provider has no image-generation surface,
 * returning the model's textual response instead.
 */
export const generateImage = async (
  args: ActionArgs
): Promise<ThreadMessageLike> => {
  const provider = providerFor(args);

  if (typeof provider.imageGeneration === "function") {
    const userPrompt = extractPrompt(args.messages);
    // Native image APIs (DALL·E, Stability) accept a single prompt string —
    // there's no system-prompt slot, so we fold any caller override into
    // the prompt itself: `replace` swaps the user text out, `append` adds
    // it as an extra instruction line.
    const prompt = args.prompt
      ? args.prompt.mode === "replace"
        ? args.prompt.text
        : `${userPrompt}\n\n${args.prompt.text}`
      : userPrompt;
    const b64 = await provider.imageGeneration({
      model: args.profile.modelId,
      prompt,
      signal: args.signal,
    });
    return {
      role: "assistant",
      content: [{ type: "image", image: `data:image/png;base64,${b64}` }],
    };
  }

  const messages = isFallbackProfile(args.profile)
    ? transformHistoryToText(args.messages)
    : args.messages;
  const text = await provider.sendMessageSync({
    messages,
    model: args.profile.modelId,
    systemPrompt: resolveSystemPrompt(systemPrompt, args.prompt),
    useResponsesApi: args.profile.useResponsesApi === true,
    withReasoning: args.isReasoning,
    signal: args.signal,
  });
  return { role: "assistant", content: [{ type: "text", text }] };
};
