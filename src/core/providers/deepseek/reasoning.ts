import {
  REASONING_DEPTHS,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * What one DeepSeek model can do with thinking. `deepseek-reasoner` is the
 * always-thinking alias: no switch, and no documented depth. Everything
 * else (`deepseek-chat`, the V4 ids) switches through `thinking.type` and
 * takes `reasoning_effort` `low` / `high` / `max`; our `medium` is the
 * model's default depth, so all four depths are distinct.
 */
export function getDeepSeekReasoningSupport(model: string): ReasoningSupport {
  if (model.includes("reasoner")) {
    return reasoningSupport([], { canDisable: false });
  }
  return reasoningSupport(REASONING_DEPTHS, { canDisable: true });
}
