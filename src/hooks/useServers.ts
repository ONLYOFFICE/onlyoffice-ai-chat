import { useEffect } from "react";
import { useStores } from "../store/context";
import { useToolsContext } from "../tools/context";

type UseServersProps = {
  isReady: boolean;
};

/**
 * Side-effect hook that initializes MCP servers, syncs host tool groups,
 * and keeps the available tool list up-to-date. Polls for tool changes
 * every 5 minutes and listens for `tools-changed` events from the event bus.
 *
 * @param props.isReady - Whether the widget is fully initialized.
 */
const useServers = ({ isReady }: UseServersProps) => {
  const {
    useServersStore,
    useProfilesStore,
    selectCurrentChatProfile,
    provider,
  } = useStores();
  const { initServers, getTools, tools } = useServersStore();
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { servers, hostToolGroups, eventBus } = useToolsContext();

  // Sync host tool groups into servers
  useEffect(() => {
    servers.hostToolSource.setGroups(hostToolGroups);
    getTools();
  }, [servers, hostToolGroups, getTools]);

  useEffect(() => {
    if (!isReady) return;

    initServers();
    getTools();

    const interval = setInterval(
      () => {
        getTools();
      },
      1000 * 60 * 5
    );

    return () => {
      clearInterval(interval);
    };
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

  useEffect(() => {
    if (!tools || !currentProfile) return;

    provider.setCurrentProviderTools(tools);
  }, [tools, currentProfile, provider]);

  return {};
};

export default useServers;
