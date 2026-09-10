import {
  NO_REASONING_SUPPORT,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * GLM-4.5 and newer think by default and switch through `thinking.type`,
 * with no depth knob. Older GLM-4 models have no thinking.
 */
export function getZhipuReasoningSupport(model: string): ReasoningSupport {
  if (!/glm-(?:4\.[5-9]|[5-9])/i.test(model)) return NO_REASONING_SUPPORT;
  return reasoningSupport([], { canDisable: true });
}
