import type { ChatEventBus } from "../providers/EventsProvider";
import type { PlatformAdapter } from "../providers/PlatformProvider/types";
import type { TMCPItem } from "../../types";
import { CustomServers } from "./sources/CustomServers";
import { HostToolSource } from "./sources/HostToolSource";

/**
 * UI-side aggregator over the *external* tool providers — the host
 * (`hostToolSource`) and the user's MCP servers (`customServers`).
 *
 * Built-in tools (web-search, image-generation) are sourced and
 * dispatched in [`core/services/web-search`](../../core/services/web-search/source.ts)
 * and [`core/services/ai/sources/image-generation`](../../core/services/ai/sources/image-generation.ts);
 * web-search configuration persistence runs through
 * [`api.webSearch`](../providers/ApiProvider/web-search.ts).
 */
class Servers {
  hostToolSource: HostToolSource;
  customServers: CustomServers;

  constructor(platform: PlatformAdapter, eventBus: ChatEventBus) {
    this.hostToolSource = new HostToolSource();
    this.customServers = new CustomServers(platform, eventBus);
  }

  getTools = async () => {
    const [hostToolsByGroup, customServersTools] = await Promise.all([
      this.hostToolSource.getToolsByGroup(),
      this.customServers.getTools(),
    ]);

    const items: Record<string, TMCPItem[]> = {
      ...hostToolsByGroup,
      ...customServersTools,
    };

    return items;
  };

  callTools = async (
    type: string,
    name: string,
    args: Record<string, unknown>
  ) => {
    if (this.hostToolSource.getGroupIds().includes(type)) {
      return this.hostToolSource.callTool(name, args);
    }
    return await this.customServers.callToolFromMCP(type, name, args);
  };

  getServerType = (name: string) => {
    for (const groupId of this.hostToolSource.getGroupIds()) {
      if (name.startsWith(`${groupId}_`)) {
        return groupId;
      }
    }
    return this.customServers.getServerType(name);
  };

  setCustomServers = (servers: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => {
    this.customServers.setCustomServers(servers);
  };

  startCustomServers = () => {
    this.customServers.startCustomServers();
  };

  restartCustomServer = (type: string) => {
    this.customServers.restartCustomServer(type);
  };

  deleteCustomServer = (type: string) => {
    this.customServers.deleteCustomServer(type);
  };

  getHostToolGroupIds = (): string[] => {
    return this.hostToolSource.getGroupIds();
  };

  getCustomServers = () => {
    return this.customServers.customServers;
  };

  getCustomServersStoped = () => {
    return this.customServers.stoppedCustomServers;
  };

  getCustomServersLogs = () => {
    return this.customServers.customServersLogs;
  };
}

export default Servers;
