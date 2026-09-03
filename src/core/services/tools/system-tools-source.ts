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
 * Async provider of the `name → config` server map for a
 * {@link SystemToolsSource}, called with the active `entityId` on every
 * operation. Lets a host back the source with a persisted registry (e.g.
 * `storage.mcpServers`) instead of a map fixed at construction.
 */
export type ServersResolver = (
  entityId?: string
) => Promise<Record<string, McpHttpServerConfig>>;

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
  private readonly serversInput:
    | Record<string, McpHttpServerConfig>
    | ServersResolver;
  private readonly fetchImpl: FetchLike;

  constructor(opts: {
    /**
     * Either a static `name → config` map (host-configured system servers,
     * fixed for the process lifetime) or an async resolver called with the
     * active `entityId` on every operation — the shape a registry-backed
     * source needs (e.g. custom MCP servers stored per agent scope). The
     * resolver result is never cached, in line with the class's no-cache
     * rule: a shared instance must not leak one caller's server set into
     * another's.
     */
    servers: Record<string, McpHttpServerConfig> | ServersResolver;
    /** Defaults to the global `fetch`. Pass a proxy to control egress. */
    fetch?: FetchLike;
  }) {
    this.serversInput = opts.servers;
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init));
  }

  private async resolveServers(
    entityId?: string
  ): Promise<Record<string, McpHttpServerConfig>> {
    if (typeof this.serversInput === "function") {
      return (await this.serversInput(entityId)) ?? {};
    }
    return this.serversInput;
  }

  async getTools(entityId?: string): Promise<Record<string, TMCPItem[]>> {
    return (await this.listAllWithErrors(await this.resolveServers(entityId)))
      .groups;
  }

  /**
   * Like {@link getTools}, but also reports why a server delivered no
   * tools: `errors[type]` carries the enumeration failure message for
   * every server whose group came back empty because the connection or
   * listing failed. A genuinely empty (but reachable) server appears in
   * `groups` with `[]` and no error entry. Used by listing endpoints so a
   * client without local access to the server can still show the failure.
   */
  async getToolsWithErrors(entityId?: string): Promise<{
    groups: Record<string, TMCPItem[]>;
    errors: Record<string, string>;
  }> {
    return this.listAllWithErrors(await this.resolveServers(entityId));
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    entityId?: string
  ): Promise<unknown> {
    // Fresh enumeration per call — no routing index is kept (see the class
    // doc). The owning server is resolved from a live listing every time.
    const servers = await this.resolveServers(entityId);
    const grouped = await this.listAll(servers);
    const type = Object.entries(grouped).find(([, tools]) =>
      tools.some((tool) => tool.name === toolName)
    )?.[0];
    if (!type || !servers[type]) {
      return JSON.stringify({ error: `Unknown system tool: ${toolName}` });
    }
    try {
      return await this.withSession(servers[type], type, (sessionId) =>
        requestToolCall(
          this.fetchImpl,
          type,
          servers[type],
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

  /**
   * Configured system server names — used to protect them on compose.
   * Only meaningful for a static map; a resolver-backed source has no
   * fixed name set, so this returns `[]` there (the host knows its own
   * registry and can compute the names itself).
   */
  getServerTypes(): string[] {
    return typeof this.serversInput === "function"
      ? []
      : Object.keys(this.serversInput);
  }

  private async listAll(
    servers: Record<string, McpHttpServerConfig>
  ): Promise<Record<string, TMCPItem[]>> {
    return (await this.listAllWithErrors(servers)).groups;
  }

  private async listAllWithErrors(
    servers: Record<string, McpHttpServerConfig>
  ): Promise<{
    groups: Record<string, TMCPItem[]>;
    errors: Record<string, string>;
  }> {
    const entries = await Promise.all(
      Object.entries(servers).map(async ([type, server]) => {
        try {
          const tools = await this.withSession(server, type, (sessionId) =>
            requestTools(this.fetchImpl, type, server, sessionId)
          );
          return [type, tools, undefined] as const;
        } catch (error) {
          logger.error(
            `[mcp] listTools failed for system server ${type}:`,
            error
          );
          // Multi-line, log-like entry — the permission card renders it in
          // the same panel as a local server's crash log: when + where the
          // enumeration ran, then what failed (step + status + body).
          const message = error instanceof Error ? error.message : String(error);
          return [
            type,
            [] as TMCPItem[],
            `${new Date().toISOString()} tools enumeration failed for ${server.url}\n${message}`,
          ] as const;
        }
      })
    );
    const groups: Record<string, TMCPItem[]> = {};
    const errors: Record<string, string> = {};
    for (const [type, tools, error] of entries) {
      groups[type] = tools;
      if (error !== undefined) errors[type] = error;
    }
    logger.debug(
      "[system-tools] enumerated:",
      Object.fromEntries(
        entries.map(([type, tools]) => [type, tools.map((t) => t.name)])
      )
    );
    return { groups, errors };
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
    server: McpHttpServerConfig,
    type: string,
    op: (sessionId?: string) => Promise<T>
  ): Promise<T> {
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
