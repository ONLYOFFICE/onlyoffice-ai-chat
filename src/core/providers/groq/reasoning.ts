import {
  NO_REASONING_SUPPORT,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * What one Groq-hosted model can do with `reasoning_effort`:
 *
 * - Qwen 3.8 and newer: `low` / `medium` / `high` and `none`.
 * - Every other Qwen (qwen3-32b, 3.6, …): `default` (our `medium`) and
 *   `none` only.
 * - GPT-OSS: `low` / `medium` / `high`, cannot stop reasoning.
 * - Everything else (Llama, …) has no reasoning.
 */
export function getGroqReasoningSupport(model: string): ReasoningSupport {
  const id = model.toLowerCase();
  if (id.includes("qwen")) {
    const gen = /qwen3\.(\d+)/.exec(id);
    return gen && Number(gen[1]) >= 8
      ? reasoningSupport(["low", "medium", "high"], { canDisable: true })
      : reasoningSupport(["medium"], { canDisable: true });
  }
  if (id.includes("gpt-oss")) {
    return reasoningSupport(["low", "medium", "high"], { canDisable: false });
  }
  return NO_REASONING_SUPPORT;
}
