import type { TMCPItem } from "../../../shared/mcp-item";
import type { ToolsAdapter } from "../../tools-adapter";
import {
  callTool as rpcCallTool,
  listTools,
  type FetchLike,
  type McpHttpServerConfig,
} from "./mcp-http-client";

/**
 * Server-side {@link ToolsAdapter} backed by host-configured "system"
 * MCP servers (HTTP transport). These servers are wired on the server,
 * never persisted to `storage.mcpServers`, and never returned by
 * `listCustomServers` — so they stay out of the config editor and can't
 * be deleted from the UI.
 *
 * Because the adapter runs in-engine, system tools are enumerated and
 * executed entirely server-side during a chat stream — credentials in
 * `headers` never reach the browser. Compose this with a host's own
 * adapter via {@link composeToolsAdapters}.
 *
 * Tool lists are enumerated on every {@link getTools} call.
 */
export class SystemToolsSource implements ToolsAdapter {
  private readonly servers: Record<string, McpHttpServerConfig>;
  private readonly fetchImpl: FetchLike;

  constructor(opts: {
    servers: Record<string, McpHttpServerConfig>;
    /** Defaults to the global `fetch`. Pass a proxy to control egress. */
    fetch?: FetchLike;
  }) {
    this.servers = opts.servers;
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init));
  }

  async getTools(): Promise<Record<string, TMCPItem[]>> {
    return this.listAll();
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const grouped = await this.getTools();
    for (const [type, tools] of Object.entries(grouped)) {
      if (tools.some((tool) => tool.name === toolName)) {
        try {
          return await rpcCallTool(
            this.fetchImpl,
            type,
            this.servers[type],
            toolName,
            args
          );
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    return JSON.stringify({ error: `Unknown system tool: ${toolName}` });
  }

  /** Configured system server names — used to protect them on compose. */
  getServerTypes(): string[] {
    return Object.keys(this.servers);
  }

  private async listAll(): Promise<Record<string, TMCPItem[]>> {
    const entries = await Promise.all(
      Object.entries(this.servers).map(
        async ([type, server]) =>
          [type, await listTools(this.fetchImpl, type, server)] as const
      )
    );
    const out: Record<string, TMCPItem[]> = {};
    for (const [type, tools] of entries) out[type] = tools;
    return out;
  }
}
