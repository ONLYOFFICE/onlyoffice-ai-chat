import { ThinkingLevel } from "@google/genai";

type ThinkingConfig = {
  thinkingLevel?: ThinkingLevel;
  thinkingBudget?: number;
  includeThoughts?: boolean;
};

/**
 * The `thinkingConfig` for one Gemini round.
 *
 * On: the model's default depth, with thoughts included so the transcript
 * can render the thinking block.
 *
 * Off has to be spelled out — Gemini 2.5 Pro/Flash and every Gemini 3
 * model think *by default*, so omitting the config leaves them reasoning
 * with the toggle off. The floor differs per model:
 *
 * - `gemini-2.5-flash*`: `thinkingBudget: 0` turns thinking off outright.
 * - `gemini-2.5-pro` and the Gemini 3 families: no off switch. The
 *   lowest level the model accepts is sent — `minimal` where supported
 *   (3 Flash, 3.5 Flash / Flash-Lite, 3.6 Flash; "matches the no-thinking
 *   setting for most queries"), `low` everywhere else.
 * - Anything older (2.0, 1.5) has no thinking: the field is omitted, as
 *   these models reject it.
 */
export function resolveThinkingConfig(
  model: string,
  withReasoning?: boolean
): ThinkingConfig | undefined {
  if (withReasoning) {
    return {
      thinkingLevel: ThinkingLevel.THINKING_LEVEL_UNSPECIFIED,
      includeThoughts: true,
    };
  }
  const id = model.toLowerCase();
  if (/gemini-2\.5-flash/.test(id)) return { thinkingBudget: 0 };
  if (/gemini-3(?:\.[56])?-flash/.test(id)) {
    return { thinkingLevel: ThinkingLevel.MINIMAL };
  }
  if (/gemini-(?:2\.5-pro|3)/.test(id)) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return undefined;
}
