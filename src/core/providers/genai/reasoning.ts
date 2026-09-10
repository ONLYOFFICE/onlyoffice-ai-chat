import {
  NO_REASONING_SUPPORT,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * What one Gemini model can do with thinking, per Google's per-model
 * `thinking_level` table:
 *
 * - Gemini 2.5 Flash / Flash-Lite: `low` / `medium` / `high`, and
 *   `thinkingBudget: 0` turns thinking off outright.
 * - Gemini 2.5 Pro and every Gemini 3 model: `low` / `medium` / `high`
 *   with no off switch. The one exception is `gemini-3-pro-preview`,
 *   which knows only `low` and `high`.
 * - Gemini 2.0, 1.5 and the non-Gemini ids (Imagen, Veo, embeddings) have
 *   no thinking.
 */
export function getGenAIReasoningSupport(model: string): ReasoningSupport {
  const id = model.toLowerCase();
  if (!/gemini-(?:2\.5|3)/.test(id)) return NO_REASONING_SUPPORT;
  if (/gemini-2\.5-flash/.test(id)) {
    return reasoningSupport(["low", "medium", "high"], { canDisable: true });
  }
  if (/gemini-3-pro/.test(id)) {
    return reasoningSupport(["low", "high"], { canDisable: false });
  }
  return reasoningSupport(["low", "medium", "high"], { canDisable: false });
}
