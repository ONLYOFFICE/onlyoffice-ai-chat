import type { TMCPItem } from "../../../shared/mcp-item";
import type { ToolsAdapter } from "../../tools-adapter";

/**
 * Combine several {@link ToolsAdapter}s into one.
 *
 * - `getTools` merges every adapter's grouped output. Server-type keys
 *   are expected to be unique across adapters; on collision the
 *   later adapter wins.
 * - `callTool` routes by ownership: the first adapter whose `getTools`
 *   lists the requested name handles the call. If none claim it, the
 *   last adapter receives it (so a host adapter can still handle
 *   dynamically-named tools).
 *
 * Use this on the server to plug a {@link SystemToolsSource} alongside
 * an existing host adapter:
 *
 * ```ts
 * const toolsAdapter = composeToolsAdapters(systemSource, hostAdapter);
 * new AIEngine({ ...deps, toolsAdapter });
 * ```
 */
export function composeToolsAdapters(
  ...adapters: Array<ToolsAdapter | undefined>
): ToolsAdapter {
  const list = adapters.filter((a): a is ToolsAdapter => Boolean(a));

  return {
    async getTools(entityId, config) {
      const results = await Promise.all(
        list.map((adapter) => adapter.getTools(entityId, config))
      );
      const merged: Record<string, TMCPItem[]> = {};
      for (const result of results) Object.assign(merged, result);
      return merged;
    },

    async callTool(toolName, args, entityId) {
      for (const adapter of list) {
        const grouped = await adapter.getTools(entityId);
        const owns = Object.values(grouped).some((tools) =>
          tools.some((tool) => tool.name === toolName)
        );
        if (owns) return adapter.callTool(toolName, args, entityId);
      }
      const last = list[list.length - 1];
      if (last) return last.callTool(toolName, args, entityId);
      return JSON.stringify({ error: `No adapter for tool: ${toolName}` });
    },
  };
}
