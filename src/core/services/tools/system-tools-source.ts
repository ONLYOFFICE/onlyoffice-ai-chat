import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";
import type { ToolsAdapter } from "../../tools-adapter";
import {
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
 * Caching (all keyed to this instance, so the host controls the scope — a
 * per-tenant instance yields a per-tenant cache):
 *
 * - The enumerated tool list is cached for {@link TOOLS_TTL_MS}, so
 *   `buildToolContext` calling {@link getTools} on every chat round no
 *   longer re-enumerates every server each time.
 * - A `toolName → serverType` index built from that list lets
 *   {@link callTool} route directly instead of re-listing every server.
 * - The `Mcp-Session-Id` per stateful server is reused across `tools/list`
 *   and `tools/call` instead of a fresh `initialize` handshake per call,
 *   re-opened once if the server later rejects it (HTTP 4xx).
 */
export class SystemToolsSource implements ToolsAdapter {
  private static readonly TOOLS_TTL_MS = 30_000;

  private readonly servers: Record<string, McpHttpServerConfig>;
  private readonly fetchImpl: FetchLike;
  /** `serverType → Mcp-Session-Id` for stateful servers. */
  private readonly sessions = new Map<string, string>();
  private toolsCache?: { at: number; grouped: Record<string, TMCPItem[]> };
  /** `toolName → serverType`, rebuilt whenever the tool cache refreshes. */
  private routeIndex = new Map<string, string>();

  constructor(opts: {
    servers: Record<string, McpHttpServerConfig>;
    /** Defaults to the global `fetch`. Pass a proxy to control egress. */
    fetch?: FetchLike;
  }) {
    this.servers = opts.servers;
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init));
  }

  async getTools(): Promise<Record<string, TMCPItem[]>> {
    const now = Date.now();
    if (
      this.toolsCache &&
      now - this.toolsCache.at < SystemToolsSource.TOOLS_TTL_MS
    ) {
      return this.toolsCache.grouped;
    }
    const grouped = await this.listAll();
    this.toolsCache = { at: now, grouped };
    this.routeIndex = new Map();
    for (const [type, tools] of Object.entries(grouped)) {
      for (const tool of tools) this.routeIndex.set(tool.name, type);
    }
    return grouped;
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    let type = this.routeIndex.get(toolName);
    if (!type) {
      // Cold cache (or a tool we haven't indexed) — enumerate once to route.
      await this.getTools();
      type = this.routeIndex.get(toolName);
    }
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
   * Run `op` with this server's cached session, opening one on first use.
   * If the server rejects the request with an HTTP 4xx (a session it no
   * longer recognises), re-open the session once and retry — but never on
   * tool-level JSON-RPC errors or 5xx, so a `tools/call` is not executed
   * twice.
   */
  private async withSession<T>(
    type: string,
    op: (sessionId?: string) => Promise<T>
  ): Promise<T> {
    const server = this.servers[type];
    let sessionId = this.sessions.get(type);
    if (sessionId === undefined) {
      sessionId = await openSession(this.fetchImpl, type, server);
      if (sessionId) this.sessions.set(type, sessionId);
    }
    try {
      return await op(sessionId);
    } catch (error) {
      const staleSession =
        !!sessionId &&
        error instanceof Error &&
        /^HTTP 4\d\d$/.test(error.message);
      if (!staleSession) throw error;
      this.sessions.delete(type);
      const fresh = await openSession(this.fetchImpl, type, server);
      if (fresh) this.sessions.set(type, fresh);
      return op(fresh);
    }
  }
}
