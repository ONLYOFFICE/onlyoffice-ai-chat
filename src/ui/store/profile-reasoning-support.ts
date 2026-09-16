import {
  clampReasoningLevel,
  DEFAULT_REASONING_LEVEL,
  FULL_REASONING_SUPPORT,
  type ReasoningDepth,
  type ReasoningSupport,
} from "../../shared/reasoning-level";
import { getReasoningSupport } from "../../core/providers";
import type { Profile } from "../../types";

/**
 * What the profile's model can do with extended thinking. A record the
 * provider's catalogue reported at save time (`profile.reasoningSupport`)
 * wins — it describes the exact model behind the id. Otherwise the
 * provider's id-based table answers; an `external` profile is answered for
 * the provider it is based on, since that is whose request shape goes out.
 * No profile yet → everything, so the controls render as they always did
 * until one is picked.
 */
export function resolveProfileReasoningSupport(
  profile: Pick<
    Profile,
    "providerType" | "basedOn" | "modelId" | "reasoningSupport"
  > | null
): ReasoningSupport {
  if (!profile) return FULL_REASONING_SUPPORT;
  if (profile.reasoningSupport) return profile.reasoningSupport;
  const type =
    profile.providerType === "external"
      ? (profile.basedOn ?? "openai")
      : profile.providerType;
  return getReasoningSupport(type, profile.modelId);
}

/**
 * The depth a model starts at: the catalogue's `default_effort` where the
 * provider reports one (`defaultDepth`), else the standard depth — either
 * way clamped to the depths the model distinguishes. `undefined` for a
 * model that does not think.
 */
export function defaultReasoningDepth(
  support: ReasoningSupport
): ReasoningDepth | undefined {
  if (!support.thinks) return undefined;
  const depth = clampReasoningLevel(
    support.defaultDepth ?? DEFAULT_REASONING_LEVEL,
    support
  );
  return depth === "off" ? undefined : depth;
}
