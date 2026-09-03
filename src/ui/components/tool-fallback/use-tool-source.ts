import { useToolsContext } from "../../tools/context";
import { useStores } from "../../store/context";

/**
 * Source label for tools that don't belong to any server listed on the MCP
 * Servers settings page (built-ins such as web search or image generation).
 */
export const SYSTEM_SOURCE = "ONLYOFFICE";

export type ToolCallSource = {
  /** Server type (host group id / server config key), `""` for built-ins. */
  type: string;
  /** Tool name with the `${type}_` qualifier stripped. */
  name: string;
  /**
   * Human-readable tool label: the `displayName` the server card on the MCP
   * Servers page shows, falling back to the bare {@link name}.
   */
  displayName: string;
  /** Label for the "Source:" line — see {@link SYSTEM_SOURCE}. */
  sourceLabel: string;
};

/**
 * Resolve where a model-emitted tool name comes from, the way the MCP
 * Servers page names it. Every server that has a card there — host groups,
 * user-configured servers and host-executed system servers — is named after
 * that card: host groups carry a display name, the others are keyed by their
 * config name. Anything unresolved is a built-in tool and is attributed to
 * ONLYOFFICE itself.
 */
export const useToolCallSource = (toolName: string): ToolCallSource => {
  const { servers: serversInstance } = useToolsContext();
  const { useServersStore } = useStores();
  const serverGroups = useServersStore((s) => s.servers);

  const type = serversInstance.getServerType(toolName);
  const name = type ? toolName.replace(`${type}_`, "") : toolName;

  // Host-executed system servers never reach the local `Servers` instance;
  // the store map (the one the permission cards render from) still lists
  // their tools, so fall back to an exact-name lookup there.
  const storeEntry = Object.entries(serverGroups ?? {}).find(([, items]) =>
    items.some((item) => item.name === toolName)
  );
  const sourceType = type || storeEntry?.[0] || "";

  const hostGroupIds = serversInstance.getHostToolGroupIds();
  const sourceLabel = !sourceType
    ? SYSTEM_SOURCE
    : hostGroupIds.includes(sourceType)
      ? serversInstance.getHostToolGroupDisplayName(sourceType)
      : sourceType;

  const storeTool =
    (sourceType ? serverGroups?.[sourceType] : undefined)?.find(
      (item) => item.name === toolName || item.name === name
    ) ?? storeEntry?.[1].find((item) => item.name === toolName);
  const displayName = storeTool?.displayName ?? name;

  return { type, name, displayName, sourceLabel };
};
