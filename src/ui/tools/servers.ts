import type { ChatEventBus } from "../providers/EventsProvider";
import type { PlatformAdapter } from "../providers/PlatformProvider/types";
import type { TMCPItem } from "../../types";
import { stripToolIntent } from "../../shared/tool-intent";
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

  /**
   * Per-server MCP `initialize` instructions, keyed by server type. Only
   * the user's MCP servers have any: host tools are plain functions with
   * no handshake behind them.
   */
  getToolInstructions = (): Record<string, string> => {
    return this.customServers.getInstructions();
  };

  callTools = async (
    type: string,
    name: string,
    args: Record<string, unknown>
  ) => {
    // Strip the synthetic `aiChatIntent` arg before it reaches the real tool.
    const cleanArgs = stripToolIntent(args);
    if (this.hostToolSource.getGroupIds().includes(type)) {
      return this.hostToolSource.callTool(name, cleanArgs);
    }
    return await this.customServers.callToolFromMCP(type, name, cleanArgs);
  };

  /**
   * Convert a model-emitted tool name to the bare name its source expects:
   * strips the `${type}_` qualifier, except for host groups that emit bare
   * names (`qualifyNames: false`), where the emitted name IS the bare name.
   */
  toBareName = (type: string, name: string) => {
    if (this.hostToolSource.emitsBareNames(type)) {
      return name;
    }
    return name.replace(`${type}_`, "");
  };

  getServerType = (name: string) => {
    // Exact emitted-name lookup first: covers `qualifyNames: false` groups,
    // whose tool names carry no group prefix.
    const owner = this.hostToolSource.getGroupIdForEmittedName(name);
    if (owner) {
      return owner;
    }
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

  /** Wait until every configured custom server is ready or stopped, bounded by `timeoutMs`. */
  waitUntilCustomServersReady = (timeoutMs?: number): Promise<void> => {
    return this.customServers.waitUntilReady(timeoutMs);
  };

  restartCustomServer = (type: string) => {
    this.customServers.restartCustomServer(type);
  };

  deleteCustomServer = (type: string) => {
    this.customServers.deleteCustomServer(type);
  };

  /**
   * Tear down all custom MCP servers — terminate stdio child processes and
   * close HTTP MCP sessions. Call on widget unmount to avoid orphaning
   * processes and stateful sessions. Host tools require no teardown.
   */
  dispose = () => {
    this.customServers.dispose();
  };

  getHostToolGroupIds = (): string[] => {
    return this.hostToolSource.getGroupIds();
  };

  getHostToolGroupDisplayName = (groupId: string): string => {
    return this.hostToolSource.getGroupDisplayName(groupId);
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
