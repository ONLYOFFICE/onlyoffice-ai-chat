import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";

/**
 * Server-side MCP client over HTTP (JSON-RPC 2.0 / Streamable HTTP).
 *
 * Runs in core (Node / server) rather than the browser. Supports both
 * transport modes:
 *
 * - **Stateless** servers — each `POST` is independent; no session header.
 * - **Stateful (session)** servers — `initialize` returns an
 *   `Mcp-Session-Id` response header; subsequent requests must echo it
 *   and the client must send the `notifications/initialized` handshake.
 *
 * Every request advertises `Accept: application/json, text/event-stream`
 * (required by Streamable HTTP) and carries the session id when one was
 * issued. Stateless servers that never return a session id keep working
 * unchanged — the header is simply omitted.
 */

/** Minimal fetch contract — host passes `globalThis.fetch` or a proxy. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** HTTP MCP server connection details. */
export type McpHttpServerConfig = {
  url: string;
  headers?: Record<string, string>;
};

const CLIENT_INFO = { name: "ai-chat", version: "1.0.0" };
// Latest Streamable HTTP spec revision (announced by docspace-mcp v3.1.0+).
// Version negotiation is soft — the server echoes the revision it supports
// in the initialize result, which we don't hard-validate, so this stays
// compatible with older servers too.
const PROTOCOL_VERSION = "2025-06-18";
const ACCEPT = "application/json, text/event-stream";

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

type RpcResult = {
  messages: JsonRpcMessage[];
  /** `Mcp-Session-Id` from the response, if the server issued one. */
  sessionId?: string;
};

/**
 * Issue one JSON-RPC POST. Always sends `Content-Type` + `Accept`
 * (Streamable HTTP negotiation); echoes `Mcp-Session-Id` when a session
 * is active. Returns the parsed messages and any session id the server
 * handed back. The negotiation headers are applied last so a host's
 * forwarded headers can never clobber them.
 */
async function rpc(
  fetchImpl: FetchLike,
  server: McpHttpServerConfig,
  body: unknown,
  sessionId?: string
): Promise<RpcResult> {
  const headers: Record<string, string> = {
    ...server.headers,
    "Content-Type": "application/json",
    Accept: ACCEPT,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetchImpl(server.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const returnedSession = response.headers.get("Mcp-Session-Id") ?? undefined;
  const text = await response.text();
  return {
    messages: parseSSEResponse(text) as JsonRpcMessage[],
    sessionId: returnedSession,
  };
}

/**
 * Run the MCP `initialize` handshake. On a stateful server this captures
 * the `Mcp-Session-Id` and fires the required `notifications/initialized`
 * notification (best-effort — some servers answer `202` with no body).
 * Returns the session id, or `undefined` for stateless servers.
 */
export async function openSession(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig
): Promise<string | undefined> {
  const init = await rpc(fetchImpl, server, {
    jsonrpc: "2.0",
    id: `init-${type}`,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      clientInfo: CLIENT_INFO,
    },
  });

  const { sessionId } = init;
  if (sessionId) {
    try {
      await rpc(
        fetchImpl,
        server,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        sessionId
      );
    } catch {
      // Best-effort: the handshake notification is fire-and-forget.
    }
  }
  return sessionId;
}

/**
 * Enumerate the tools a server exposes: `initialize` handshake (with
 * session capture) followed by `tools/list`. Returns the tool
 * descriptors, or an empty list on any failure (logged, never thrown —
 * a broken system server must not break the whole tool context).
 */
/**
 * `tools/list` over an already-open session (no handshake). Throws on
 * transport failure so a caller managing a session cache can re-open and
 * retry. Returns `[]` when the response carries no tool array.
 */
export async function requestTools(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig,
  sessionId?: string
): Promise<TMCPItem[]> {
  const { messages } = await rpc(
    fetchImpl,
    server,
    { jsonrpc: "2.0", id: `tools-${type}`, method: "tools/list", params: {} },
    sessionId
  );
  for (const msg of messages) {
    const tools = (msg.result as { tools?: TMCPItem[] } | undefined)?.tools;
    if (Array.isArray(tools)) return tools;
  }
  return [];
}

/**
 * `tools/call` over an already-open session (no handshake). Throws on a
 * JSON-RPC error, a missing result, or a transport failure.
 */
export async function requestToolCall(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  sessionId?: string
): Promise<string> {
  const { messages } = await rpc(
    fetchImpl,
    server,
    {
      jsonrpc: "2.0",
      id: `call-${type}-${toolName}`,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    },
    sessionId
  );
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

/**
 * Enumerate the tools a server exposes: `initialize` handshake (with
 * session capture) followed by `tools/list`. Returns the tool
 * descriptors, or an empty list on any failure (logged, never thrown —
 * a broken system server must not break the whole tool context).
 */
export async function listTools(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig
): Promise<TMCPItem[]> {
  try {
    const sessionId = await openSession(fetchImpl, type, server);
    const tools = await requestTools(fetchImpl, type, server, sessionId);
    logger.debug(
      `[mcp] listTools ${type}: ${tools.length} tool(s) — ` +
        `${tools.map((t) => t.name).join(", ") || "(none)"}`
    );
    return tools;
  } catch (error) {
    logger.error(`[mcp] listTools failed for system server ${type}:`, error);
    return [];
  }
}

/**
 * Invoke a tool via `tools/call`. Opens a session first (`initialize` +
 * `notifications/initialized`) so stateful servers accept the call, then
 * sends `tools/call` with the session id. Returns the result serialised
 * to a string (provider SDKs require string tool results); throws on a
 * JSON-RPC error or a missing result so the caller can surface it.
 */
export async function callTool(
  fetchImpl: FetchLike,
  type: string,
  server: McpHttpServerConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const sessionId = await openSession(fetchImpl, type, server);
  return requestToolCall(fetchImpl, type, server, toolName, args, sessionId);
}
