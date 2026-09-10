import { useMemo } from "react";
import {
  FULL_REASONING_SUPPORT,
  type ReasoningSupport,
} from "../../shared/reasoning-level";
import { getReasoningSupport } from "../../core/providers";
import type { Profile } from "../../types";
import { useStores } from "../store/context";

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

/** {@link resolveProfileReasoningSupport} for the current chat profile. */
export function useReasoningSupport(): ReasoningSupport {
  const { useProfilesStore, selectCurrentChatProfile } = useStores();
  const profile = useProfilesStore(selectCurrentChatProfile);
  const providerType = profile?.providerType;
  const basedOn = profile?.basedOn;
  const modelId = profile?.modelId;
  const reasoningSupport = profile?.reasoningSupport;
  return useMemo(
    () =>
      resolveProfileReasoningSupport(
        providerType && modelId
          ? { providerType, basedOn, modelId, reasoningSupport }
          : null
      ),
    [providerType, basedOn, modelId, reasoningSupport]
  );
}
