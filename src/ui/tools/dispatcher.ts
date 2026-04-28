import type { ToolDispatcher } from "../../core/services";
import type Servers from "./servers";

/**
 * Adapter from the live browser-side {@link Servers} aggregator to the
 * core's transport-agnostic {@link ToolDispatcher} contract. Built so
 * `AIEngine` can drive tool execution without depending on the
 * browser tools runtime — and so a server-side embedding can swap in
 * its own implementation of `ToolDispatcher` without touching `Servers`.
 */
export function createServersDispatcher(servers: Servers): ToolDispatcher {
  return {
    getServerType: (toolName) => servers.getServerType(toolName),
    callTool: (serverType, toolName, args) =>
      servers.callTools(serverType, toolName, args),
    isAutoApproved: (serverType, toolName) =>
      servers.checkAllowAlways(serverType, toolName),
    setAutoApproved: (serverType, toolName, value) => {
      servers.setAllowAlways(value, serverType, toolName);
    },
  };
}
