import { ActionType } from "../../../shared/action-type";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Profile } from "../../types";

/**
 * Minimum {@link CapabilitiesUI} bits a profile must declare to be a
 * valid assignment target for each {@link ActionType}.
 *
 * - `Default` is the fallback slot — no requirement, the chosen profile
 *   is dispatched only when no per-action slot is filled.
 * - Text-only actions need `Chat`.
 * - `OCR` and `Vision` need `Vision` (image input).
 * - `ImageGeneration` needs `Image` (image output).
 */
export const ACTION_REQUIREMENTS: Record<ActionType, number> = {
  [ActionType.Default]: CapabilitiesUI.None,
  [ActionType.Chat]: CapabilitiesUI.Chat,
  [ActionType.Summarization]: CapabilitiesUI.Chat,
  [ActionType.Translation]: CapabilitiesUI.Chat,
  [ActionType.TextAnalyze]: CapabilitiesUI.Chat,
  [ActionType.ImageGeneration]: CapabilitiesUI.Image,
  [ActionType.OCR]: CapabilitiesUI.Vision,
  [ActionType.Vision]: CapabilitiesUI.Vision,
};

/**
 * True if `profile.capabilities` declares every bit required by
 * `actionType`. Profiles with `capabilities` undefined or `0` have no
 * declared support and only satisfy the empty `Default` requirement.
 */
export function meetsRequirements(
  profile: Pick<Profile, "capabilities">,
  actionType: ActionType
): boolean {
  const required = ACTION_REQUIREMENTS[actionType];
  const caps = profile.capabilities ?? CapabilitiesUI.None;
  return (caps & required) === required;
}
