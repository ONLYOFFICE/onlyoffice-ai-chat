import { useEffect } from "react";
import { useStores } from "../store/context";
import { useToolsContext } from "../tools/context";

type UseServersProps = {
  isReady: boolean;
};

/**
 * Side-effect hook that initializes MCP servers, syncs host tool groups,
 * and keeps the available tool list up-to-date. Tool changes flow through
 * the `tools-changed` event on the event bus — there is no periodic poll.
 *
 * @param props.isReady - Whether the widget is fully initialized.
 */
const useServers = ({ isReady }: UseServersProps) => {
  const { useServersStore } = useStores();
  const initServers = useServersStore((s) => s.initServers);
  const getTools = useServersStore((s) => s.getTools);
  const { servers, hostToolGroups, eventBus } = useToolsContext();

  // Sync host tool groups into the servers aggregator. The actual tool
  // fetch is deferred to the ready effect below so we don't double-call
  // `getTools` on initial mount.
  useEffect(() => {
    servers.hostToolSource.setGroups(hostToolGroups);
  }, [servers, hostToolGroups]);

  useEffect(() => {
    if (!isReady) return;
    initServers();
    getTools();
  }, [isReady, initServers, getTools]);

  useEffect(() => {
    const handler = () => {
      getTools();
    };
    eventBus.on("tools-changed", handler);
    return () => {
      eventBus.off("tools-changed", handler);
    };
  }, [getTools, eventBus]);

  return {};
};

export default useServers;
