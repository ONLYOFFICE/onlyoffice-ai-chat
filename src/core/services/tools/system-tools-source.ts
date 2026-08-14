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
 * Caching (all keyed to this instance, so the host controls the scope — a
 * per-tenant instance yields a per-tenant cache):
 *
 * - The enumerated tool list is cached for {@link TOOLS_TTL_MS}, so
 *   `buildToolContext` calling {@link getTools} on every chat round no
 *   longer re-enumerates every server each time.
 * - A `toolName → serverType` index built from that list lets
 *   {@link callTool} route directly instead of re-listing every server.
 *
 * Sessions are deliberately NOT cached: every `tools/list` / `tools/call`
 * opens its own MCP session and closes it right after. An MCP server may
 * bind per-request credentials (auth token, target portal) to the session
 * at `initialize` — docspace-mcp does — so a session shared across calls
 * would execute every user's tools under whoever initialized it first,
 * against that user's portal. The extra handshake round-trip per call is
 * the price of per-caller identity.
 */
export class SystemToolsSource implements ToolsAdapter {
  private static readonly TOOLS_TTL_MS = 30_000;

  private readonly servers: Record<string, McpHttpServerConfig>;
  private readonly fetchImpl: FetchLike;
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
