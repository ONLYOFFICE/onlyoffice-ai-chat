import { useEffect } from "react";
import { useStores } from "../store/context";

/**
 * Page-level hook that loads profiles + assignments into the
 * profiles store on mount. Re-fires on every mount, so navigating
 * between pages refreshes the data.
 *
 * Use this in any standalone page that needs the profiles list
 * (`AiModelsPage`, `ModelAssignmentPage`, `Settings`, `ChatPage`).
 * The full `AIChatWidget` no longer initialises profiles globally —
 * each page declares its own data dependencies.
 */
const useEnsureProfiles = () => {
  const { useProfilesStore } = useStores();
  const init = useProfilesStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);
};

export default useEnsureProfiles;
