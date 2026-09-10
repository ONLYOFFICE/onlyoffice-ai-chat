import { ThinkingLevel } from "@google/genai";
import {
  effectiveReasoningLevel,
  type ReasoningDepth,
  type ReasoningLevel,
} from "../../../shared/reasoning-level";
import type { ReasoningSupport } from "../../../shared/reasoning-level";
import { getGenAIReasoningSupport } from "./reasoning";

type ThinkingConfig = {
  thinkingLevel?: ThinkingLevel;
  thinkingBudget?: number;
  includeThoughts?: boolean;
};

/** `thinkingLevel` per depth; `max` never survives the clamp below. */
const LEVELS: Record<ReasoningDepth, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
  max: ThinkingLevel.HIGH,
};

/**
 * The `thinkingConfig` for one Gemini round.
 *
 * On: the requested depth as a `thinkingLevel`, clamped to what
 * {@link getGenAIReasoningSupport} lists for the model (`max` → `HIGH`
 * everywhere, `medium` → `HIGH` on 3 Pro preview, which has no medium),
 * with thoughts included so the transcript can render the thinking block.
 * Models without thinking get no field, as they reject it.
 *
 * Off has to be spelled out — Gemini 2.5 Flash thinks *by default*, so
 * omitting the config leaves it reasoning with the toggle off:
 * `thinkingBudget: 0` turns it off outright. Gemini 2.5 Pro and every
 * Gemini 3 model have no off switch; the composer offers them none, and a
 * stored off means the standard depth like on every other provider
 * (`MEDIUM`, or `HIGH` on 3 Pro preview).
 */
export function resolveThinkingConfig(
  model: string,
  level: ReasoningLevel,
  support: ReasoningSupport = getGenAIReasoningSupport(model)
): ThinkingConfig | undefined {
  if (!support.thinks) return undefined;
  const effective = effectiveReasoningLevel(level, support);
  if (effective !== "off") {
    return { thinkingLevel: LEVELS[effective], includeThoughts: true };
  }
  return { thinkingBudget: 0 };
}
