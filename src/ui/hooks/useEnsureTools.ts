import { useEffect } from "react";
import { useStores } from "../store/context";
import { useToolsContext } from "../tools/context";

/**
 * Page-level hook that initialises MCP servers, syncs host tool
 * groups, and fetches the available tool list on mount. Subscribes
 * to `tools-changed` events on the bus for the duration of the
 * mount so toggles in other parts of the UI propagate.
 *
 * Re-fires on every mount — moving away from the page and back
 * triggers a fresh fetch.
 */
const useEnsureTools = () => {
  const { useServersStore } = useStores();
  const initServers = useServersStore((s) => s.initServers);
  const getTools = useServersStore((s) => s.getTools);
  const { servers, hostToolGroups, eventBus } = useToolsContext();

  useEffect(() => {
    servers.hostToolSource.setGroups(hostToolGroups);
  }, [servers, hostToolGroups]);

  useEffect(() => {
    initServers();
    getTools();
  }, [initServers, getTools]);

  useEffect(() => {
    const handler = () => {
      getTools();
    };
    eventBus.on("tools-changed", handler);
    return () => {
      eventBus.off("tools-changed", handler);
    };
  }, [getTools, eventBus]);
};

export default useEnsureTools;
