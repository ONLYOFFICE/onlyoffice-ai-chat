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
  [ActionType.Code]: CapabilitiesUI.Chat,
  [ActionType.Summarization]: CapabilitiesUI.Chat,
  [ActionType.Translation]: CapabilitiesUI.Chat,
  [ActionType.TextAnalyze]: CapabilitiesUI.Chat,
  [ActionType.ImageGeneration]: CapabilitiesUI.Image,
  [ActionType.OCR]: CapabilitiesUI.Vision,
  [ActionType.Vision]: CapabilitiesUI.Vision,
  [ActionType.FormAnalysis]: CapabilitiesUI.Chat,
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

/**
 * Whether a profile reached through the `Default` *fallback* may run
 * `actionType`. Lenient twin of {@link meetsRequirements}: a profile that
 * declares no capabilities at all (`undefined` or `0`, typical for
 * profiles injected by a host) is let through unchanged, so the fallback
 * keeps working for every chat profile that predates capability
 * tracking. Only a profile that *does* declare its capabilities and
 * lacks the required bits is rejected — e.g. a text-only chat model
 * standing in for an empty `ImageGeneration` slot (Bug 84265).
 */
export function defaultCanServe(
  profile: Pick<Profile, "capabilities">,
  actionType: ActionType
): boolean {
  const caps = profile.capabilities ?? CapabilitiesUI.None;
  if (caps === CapabilitiesUI.None) return true;
  return meetsRequirements(profile, actionType);
}
