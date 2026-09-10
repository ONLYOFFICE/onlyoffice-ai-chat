import {
  NO_REASONING_SUPPORT,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * What one Grok model can do with `reasoning_effort`, per xAI's table.
 * Grok's reasoning cannot be switched off on any model:
 *
 * - grok-4.6 and newer (4.20-multi-agent included): `low` / `medium` /
 *   `high` / `xhigh` — our `max`.
 * - grok-4.5: `low` / `medium` / `high`.
 * - grok-3-mini: `low` / `high` only.
 * - grok-4, grok-4.1-fast, grok-code-fast: think always with no knob —
 *   they reject the parameter.
 * - grok-2, plain grok-3 and the vision / image models don't think.
 */
export function getXAIReasoningSupport(model: string): ReasoningSupport {
  const id = model.toLowerCase();
  if (/grok-(?:2|3(?!-mini))|vision|image/.test(id)) {
    return NO_REASONING_SUPPORT;
  }
  const gen4 = /grok-4\.(\d+)/.exec(id);
  if (gen4 && Number(gen4[1]) >= 6) {
    return reasoningSupport(["low", "medium", "high", "max"], {
      canDisable: false,
    });
  }
  if (gen4 && Number(gen4[1]) >= 5) {
    return reasoningSupport(["low", "medium", "high"], { canDisable: false });
  }
  if (/grok-3-mini/.test(id)) {
    return reasoningSupport(["low", "high"], { canDisable: false });
  }
  return reasoningSupport([], { canDisable: false });
}
