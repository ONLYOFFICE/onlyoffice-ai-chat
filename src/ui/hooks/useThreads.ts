import { useEffect } from "react";
import { useWidgetConfig } from "../../widget-config";
import { useStores } from "../store/context";

type UseThreadProps = {
  isReady: boolean;
};

/**
 * Side-effect hook that initializes chat threads and system prompts from
 * storage once the widget is ready. Does not return any values — data is
 * loaded into the Zustand threads and prompts stores.
 *
 * Threads are scoped by `WidgetConfig.entityId`: when set, only threads
 * bound to that entity are loaded; otherwise the unscoped (passthrough)
 * area is loaded. Prompts are unscoped.
 *
 * @param props.isReady - Whether the widget is fully initialized.
 */
const useThread = ({ isReady }: UseThreadProps) => {
  const { useThreadsStore, usePromptsStore } = useStores();
  const { initThreads } = useThreadsStore();
  const { initPrompts } = usePromptsStore();
  const { entityId } = useWidgetConfig();

  useEffect(() => {
    if (!isReady) return;

    initThreads(entityId);
    initPrompts();
  }, [isReady, entityId, initThreads, initPrompts]);

  return {};
};

export default useThread;
