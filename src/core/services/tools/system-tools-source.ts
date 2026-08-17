import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";
import type { ToolsAdapter } from "../../tools-adapter";
import {
  closeSession,
  openSession,
  requestTools,
  requestToolCall,
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
 * NOTHING is cached — neither sessions nor the tool catalog. An MCP
 * server may bind per-request credentials (auth token, target portal) to
 * the session at `initialize` — docspace-mcp does — so every
 * `tools/list` / `tools/call` opens its own session and closes it right
 * after, and every enumeration hits the servers live: an instance is
 * shared across users and portals, so any state kept here would leak one
 * caller's view (or identity) into another's. The extra round-trips per
 * operation are the price of per-caller correctness.
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
    // Fresh enumeration per call — no routing index is kept (see the class
    // doc). The owning server is resolved from a live listing every time.
    const grouped = await this.listAll();
    const type = Object.entries(grouped).find(([, tools]) =>
      tools.some((tool) => tool.name === toolName)
    )?.[0];
    if (!type || !this.servers[type]) {
      return JSON.stringify({ error: `Unknown system tool: ${toolName}` });
    }
    try {
      return await this.withSession(type, (sessionId) =>
        requestToolCall(
          this.fetchImpl,
          type as string,
          this.servers[type as string],
          toolName,
          args,
          sessionId
        )
      );
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Configured system server names — used to protect them on compose. */
  getServerTypes(): string[] {
    return Object.keys(this.servers);
  }

  private async listAll(): Promise<Record<string, TMCPItem[]>> {
    const entries = await Promise.all(
      Object.entries(this.servers).map(async ([type, server]) => {
        try {
          const tools = await this.withSession(type, (sessionId) =>
            requestTools(this.fetchImpl, type, server, sessionId)
          );
          return [type, tools] as const;
        } catch (error) {
          logger.error(
            `[mcp] listTools failed for system server ${type}:`,
            error
          );
          return [type, [] as TMCPItem[]] as const;
        }
      })
    );
    const out: Record<string, TMCPItem[]> = {};
    for (const [type, tools] of entries) out[type] = tools;
    logger.debug(
      "[system-tools] enumerated:",
      Object.fromEntries(
        entries.map(([type, tools]) => [type, tools.map((t) => t.name)])
      )
    );
    return out;
  }

  /**
   * Run `op` inside a fresh MCP session: `initialize` handshake before,
   * session termination after (best-effort, even when `op` throws). Never
   * reuses a session across calls — see the class doc: the server may bind
   * the caller's credentials and target portal to the session, so sharing
   * one would cross-wire users. Stateless servers (no session id issued)
   * just run `op` bare.
   */
  private async withSession<T>(
    type: string,
    op: (sessionId?: string) => Promise<T>
  ): Promise<T> {
    const server = this.servers[type];
    const sessionId = await openSession(this.fetchImpl, type, server);
    try {
      return await op(sessionId);
    } finally {
      if (sessionId) {
        await closeSession(this.fetchImpl, server, sessionId);
      }
    }
  }
}
