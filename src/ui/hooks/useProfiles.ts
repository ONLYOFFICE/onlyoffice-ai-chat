import { useEffect } from "react";
import { useStores } from "../store/context";

type UseProfilesProps = {
  isReady: boolean;
};

/**
 * Side-effect hook that initializes AI profiles from storage once the
 * widget is ready. Does not return any values — the profiles are loaded
 * into the Zustand profiles store.
 *
 * @param props.isReady - Whether the widget is fully initialized.
 */
const useProfiles = ({ isReady }: UseProfilesProps) => {
  const { useProfilesStore } = useStores();
  const init = useProfilesStore((s) => s.init);

  useEffect(() => {
    if (!isReady) return;

    init();
  }, [isReady, init]);

  return {};
};

export default useProfiles;
