import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";

/**
 * Server-side MCP client over HTTP (JSON-RPC 2.0).
 *
 * A dependency-free port of the HTTP transport in
 * `src/ui/tools/sources/CustomServers.ts`, meant to run in core (Node /
 * server) rather than the browser. Each call is a stateless `POST`:
 * `initialize` → `tools/list` to enumerate, `tools/call` to invoke. No
 * persistent connection, no session header — matching the existing
 * client transport's behaviour.
 */

/** Minimal fetch contract — host passes `globalThis.fetch` or a proxy. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** HTTP MCP server connection details. */
export type McpHttpServerConfig = {
  url: string;
  headers?: Record<string, string>;
};

const CLIENT_INFO = { name: "ai-chat", version: "1.0.0" };

/**
 * Parse SSE-formatted response text into JSON-RPC messages. Mirrors the
 * client transport: `data: {...}` lines are decoded; a plain JSON body
 * (no SSE framing) is parsed whole as a fallback.
 */
function parseSSEResponse(text: string): unknown[] {
  const results: unknown[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      try {
        results.push(JSON.parse(line.slice(6)));
      } catch {
        // Skip non-JSON data lines.
      }
    }
  }
  if (results.length === 0 && text.trim()) {
    try {
      results.push(JSON.parse(text));
    } catch {
      // Not valid JSON either.
    }
  }
  return results;
}

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

/** Issue one JSON-RPC POST and return every message parsed from the body. */
async function rpc(
  fetchImpl: FetchLike,
  server: McpHttpServerConfig,
  body: unknown
): Promise<JsonRpcMessage[]> {
  const response = await fetchImpl(server.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...server.headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = await response.text();
  return parseSSEResponse(text) as JsonRpcMessage[];
}

/**
 * Enumerate the tools a server exposes: `initialize` handshake followed
 * by `tools/list`. Returns the tool descriptors, or an empty list on any
 * failure (logged, never thrown — a broken system server must not break
 * the whole tool context).
 */
export async function listTools(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig
): Promise<TMCPItem[]> {
  try {
    await rpc(fetchImpl, server, {
      jsonrpc: "2.0",
      id: `init-${type}`,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        clientInfo: CLIENT_INFO,
      },
    });

    const messages = await rpc(fetchImpl, server, {
      jsonrpc: "2.0",
      id: `tools-${type}`,
      method: "tools/list",
      params: {},
    });

    for (const msg of messages) {
      const tools = (msg.result as { tools?: TMCPItem[] } | undefined)?.tools;
      if (Array.isArray(tools)) return tools;
    }
    return [];
  } catch (error) {
    logger.error(`[mcp] listTools failed for system server ${type}:`, error);
    return [];
  }
}

/**
 * Invoke a tool via `tools/call`. Returns the result serialised to a
 * string (provider SDKs require string tool results); throws on a
 * JSON-RPC error or a missing result so the caller can surface it.
 */
export async function callTool(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const messages = await rpc(fetchImpl, server, {
    jsonrpc: "2.0",
    id: `call-${type}-${toolName}`,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  for (const msg of messages) {
    if (msg.error) {
      throw new Error(
        `MCP tool error (${msg.error.code}): ${msg.error.message}`
      );
    }
    if (msg.result !== undefined) {
      return JSON.stringify(msg.result);
    }
  }
  throw new Error(`No result from system MCP server ${type}`);
}
