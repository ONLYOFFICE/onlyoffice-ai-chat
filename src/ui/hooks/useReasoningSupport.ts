import { useMemo } from "react";
import type { ReasoningSupport } from "../../shared/reasoning-level";
import { resolveProfileReasoningSupport } from "../store/profile-reasoning-support";
import { useStores } from "../store/context";

export { resolveProfileReasoningSupport };

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
