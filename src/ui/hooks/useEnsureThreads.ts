import { useEffect } from "react";
import { useWidgetConfig } from "../../widget-config";
import { useStores } from "../store/context";

/**
 * Page-level hook that loads the threads list into the threads
 * store on mount, scoped to the current `WidgetConfig.entityId`.
 * Re-fires on every mount.
 */
const useEnsureThreads = () => {
  const { useThreadsStore } = useStores();
  const initThreads = useThreadsStore((s) => s.initThreads);
  const { entityId } = useWidgetConfig();

  useEffect(() => {
    initThreads(entityId);
  }, [initThreads, entityId]);
};

export default useEnsureThreads;
