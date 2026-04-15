import { useEffect } from "react";
import { useStores } from "../store/context";

type UseThreadProps = {
  isReady: boolean;
};

/**
 * Side-effect hook that initializes chat threads and system prompts from
 * storage once the widget is ready. Does not return any values — data is
 * loaded into the Zustand threads and prompts stores.
 *
 * @param props.isReady - Whether the widget is fully initialized.
 */
const useThread = ({ isReady }: UseThreadProps) => {
  const { useThreadsStore, usePromptsStore } = useStores();
  const { initThreads } = useThreadsStore();
  const { initPrompts } = usePromptsStore();

  useEffect(() => {
    if (!isReady) return;

    initThreads();
    initPrompts();
  }, [isReady, initThreads, initPrompts]);

  return {};
};

export default useThread;
