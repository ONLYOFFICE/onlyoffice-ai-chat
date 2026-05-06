import { useEffect } from "react";
import { useStores } from "../store/context";

/**
 * Page-level hook that loads the threads list into the threads
 * store on mount. Re-fires on every mount.
 */
const useEnsureThreads = () => {
  const { useThreadsStore } = useStores();
  const initThreads = useThreadsStore((s) => s.initThreads);

  useEffect(() => {
    initThreads();
  }, [initThreads]);
};

export default useEnsureThreads;
