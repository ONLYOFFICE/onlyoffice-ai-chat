import {
  NO_REASONING_SUPPORT,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";
import { mistralInfo } from "./info";

/**
 * Mistral has no thinking switch; reasoning lives in the separate
 * Magistral models. A Magistral id thinks always with no depth knob. A
 * model with a Magistral counterpart (see `mistralInfo.reasoningModels`)
 * is swapped to it while thinking is on — on/off, no depth. Anything else
 * has no thinking.
 */
export function getMistralReasoningSupport(model: string): ReasoningSupport {
  if (/magistral/i.test(model)) {
    return reasoningSupport([], { canDisable: false });
  }
  if (mistralInfo.reasoningModels.some(([hint]) => model.includes(hint))) {
    return reasoningSupport([], { canDisable: true });
  }
  return NO_REASONING_SUPPORT;
}
