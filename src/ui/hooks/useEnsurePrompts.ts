import { useEffect } from "react";
import { useStores } from "../store/context";

/**
 * Page-level hook that loads saved prompts into the prompts store
 * on mount. Re-fires on every mount.
 */
const useEnsurePrompts = () => {
  const { usePromptsStore } = useStores();
  const initPrompts = usePromptsStore((s) => s.initPrompts);

  useEffect(() => {
    initPrompts();
  }, [initPrompts]);
};

export default useEnsurePrompts;
