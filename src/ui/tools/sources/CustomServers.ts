import type { ChatEventBus } from "../../providers/EventsProvider";
import logger from "../../../shared/logger";
import { serializeMcpToolResult } from "../../../shared/mcp-result";
import type { PlatformAdapter } from "../../providers/PlatformProvider/types";
import type { TMCPItem, TProcess } from "../../../types";

type THttpServer = {
  url: string;
  headers?: Record<string, string>;
  abortController?: AbortController;
  /**
   * `Mcp-Session-Id` captured from the `initialize` response for stateful
   * (Streamable HTTP session) servers. Echoed on every subsequent request
   * and used to terminate the session (`DELETE`) on teardown. Absent for
   * stateless servers.
   */
  sessionId?: string;
};

const getParams = (config: Record<string, unknown>) => {
  let command = "";
  const env: Record<string, string> = {};
  let args = "";

  Object.entries(config).forEach(([key, value]) => {
    if (key === "env") {
      Object.entries(value as Record<string, string>).forEach(([k, v]) => {
        env[k] = v;
      });
    }

    if (key === "command") {
      command = value as string;
    }

    if (key === "args") {
      args = (value as string[]).join(" ");
    }
  });

  const commandLine = `${command} ${args}`;

  return { commandLine, env };
};

const isHttpServer = (config: Record<string, unknown>): boolean => {
  return typeof config.url === "string";
};

// A config is startable when it names a transport: `url` (HTTP) or
// `command` (stdio). Hosts may store marker entries with an empty config —
// e.g. DocSpace agent whitelist markers for server-executed system MCP
// servers, whose real config never leaves the backend. Those must not
// reach the start path: there is nothing to spawn or fetch, and they are
// not this runtime's servers to run.
const isStartable = (config: Record<string, unknown>): boolean => {
  return isHttpServer(config) || typeof config.command === "string";
};

/**
 * Parse SSE-formatted response text to extract JSON-RPC messages.
 * SSE format: "event: message\ndata: {...json...}\n\n"
 */
const parseSSEResponse = (text: string): unknown[] => {
  const results: unknown[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const jsonStr = line.slice(6); // Remove "data: " prefix
      try {
        const parsed = JSON.parse(jsonStr);
        results.push(parsed);
      } catch {
        // Skip non-JSON data lines
      }
    }
  }

  // If no SSE format found, try parsing the whole text as JSON
  if (results.length === 0 && text.trim()) {
    try {
      results.push(JSON.parse(text));
    } catch {
      // Not valid JSON either
    }
  }

  return results;
};

/**
 * A JSON-RPC message is a plain object; primitives and arrays that a
 * server happens to print are not ours to interpret. Batches (arrays) are
 * not part of the MCP stdio transport since 2025-06-18.
 */
const isJsonRpcMessage = (value: unknown): value is JsonRpcMessage => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * Whether a host `TProcess` handle refers to a live process. Only hosts that
 * expose the native id on the handle (ONLYOFFICE desktop's `ExternalProcess`)
 * can be checked; a handle without `id` is trusted. A missing or negative id
 * is the desktop's way of saying the spawn was refused.
 */
const hostSpawnSucceeded = (process: TProcess): boolean => {
  if (!("id" in (process as object))) return true;
  const id = (process as unknown as { id?: unknown }).id;
  return typeof id === "number" && id >= 0;
};

const getHttpParams = (
  config: Record<string, unknown>
): { url: string; headers: Record<string, string> } => {
  const url = config.url as string;
  const headers = (config.headers as Record<string, string>) || {};
  return { url, headers };
};

let clientInfo: { name: string; version: string } = {
  name: "ai-chat",
  version: "1.0.0",
};

export const setClientInfo = (info: { name: string; version: string }) => {
  clientInfo = info;
};

export const getClientInfo = () => clientInfo;

const MAX_LOG_LINES = 1000;

/**
 * Upper bound for an unterminated stdout line kept between chunks. A
 * `tools/list` answer with big schemas runs to a few hundred KB; anything
 * past this is not a JSON-RPC message we are waiting for, so the buffer is
 * dropped rather than grown without limit.
 */
const MAX_STDOUT_BUFFER = 4 * 1024 * 1024;

/**
 * Delay between a `notifications/tools/list_changed` and the `tools/list`
 * it triggers. Servers that rebuild their catalog fire one notification per
 * registered tool; one listing after the burst is enough.
 */
const LIST_CHANGED_DEBOUNCE_MS = 250;

/** Shape of one JSON-RPC 2.0 message read off a server's stdout. */
type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
};

/**
 * Per-server bookkeeping for `tools/list` refreshes requested by
 * `notifications/tools/list_changed`: a pending debounce timer, whether a
 * listing is already on the wire, and whether another notification arrived
 * while it was — in which case one more listing follows the answer.
 */
type ToolsRefreshState = {
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  queued: boolean;
  /**
   * Set once a `tools/list` error has already sent this process back
   * through `initialize`. One retry per process: a server that keeps
   * refusing the listing is broken, not un-initialized.
   */
  reinitialized?: boolean;
};

class CustomServers {
  customServers: Record<string, Record<string, unknown>>;
  startedCustomServers: Record<string, string>;
  initedCustomServers: Record<string, boolean>;
  /**
   * Servers whose `tools/list` has been answered at least once since they
   * started. `waitUntilReady` checks this rather than the tool count: a
   * server may legitimately list zero tools, and a `list_changed` refresh
   * can shrink a list to zero — neither should stall a send.
   */
  listedCustomServers: Record<string, boolean>;
  /**
   * `capabilities` from each server's `initialize` result. Read for
   * diagnostics only: a server that advertises `tools.listChanged` is
   * expected to push `notifications/tools/list_changed`, one that does not
   * will never refresh its catalog until restarted.
   */
  serverCapabilities: Record<string, Record<string, unknown>>;
  stoppedCustomServers: string[];
  customServersProcesses: Record<string, TProcess>;
  httpServers: Record<string, THttpServer>;
  customServersLogs: Record<string, string[]>;
  tools: Record<string, TMCPItem[]>;
  /**
   * `instructions` from each server's `initialize` result — the server's
   * own hint on how its tools are meant to be used. Stated once at
   * handshake time and per server (not per tool), so it is kept beside
   * the tool map and handed to the engine as `actionArgs.toolInstructions`.
   */
  instructions: Record<string, string>;
  private _pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >;
  /**
   * Unterminated tail of a stdio server's stdout, per server. The host
   * hands chunks over as the pipe delivers them, so a message may arrive
   * split across two `onprocess` calls or share one call with its
   * neighbour; messages are cut on `\n` and the remainder waits here.
   */
  private stdoutBuffers: Record<string, string>;
  private toolsRefresh: Record<string, ToolsRefreshState>;
  private requestCounter: number;
  private platform: PlatformAdapter;
  private eventBus: ChatEventBus;

  constructor(platform: PlatformAdapter, eventBus: ChatEventBus) {
    this.platform = platform;
    this.eventBus = eventBus;
    this.customServers = {};
    this.startedCustomServers = {};
    this.initedCustomServers = {};
    this.listedCustomServers = {};
    this.serverCapabilities = {};
    this.customServersProcesses = {};
    this.httpServers = {};
    this.customServersLogs = {};
    this.tools = {};
    this.instructions = {};
    this.stoppedCustomServers = [];
    this._pendingRequests = new Map();
    this.stdoutBuffers = {};
    this.toolsRefresh = {};
    this.requestCounter = 0;
  }

  /**
   * Monotonic per-instance suffix for request ids. `Date.now()` collided
   * when two listings were issued within the same millisecond (initial
   * `tools/list` plus a `list_changed` refresh), and the later answer was
   * then dropped as a duplicate.
   */
  private nextRequestId = (): number => {
    this.requestCounter += 1;
    return this.requestCounter;
  };

  /** Use platform fetchProxy if available, otherwise standard fetch */
  private platformFetch = (
    url: string,
    init?: RequestInit
  ): Promise<Response> => {
    const proxy = this.platform.fetchProxy;
    return proxy ? proxy(url, init) : fetch(url, init);
  };

  /**
   * JSON-RPC request headers for an HTTP server, echoing the captured
   * `Mcp-Session-Id` when the server issued one so stateful sessions keep
   * routing to the same session. Stateless servers carry no session id and
   * the header is simply omitted.
   */
  private httpHeaders = (server: THttpServer): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...server.headers,
    };
    if (server.sessionId) headers["Mcp-Session-Id"] = server.sessionId;
    return headers;
  };

  /**
   * Terminate a stateful MCP session (Streamable HTTP `DELETE` with the
   * `Mcp-Session-Id` header). Best-effort and never throws: stateless
   * servers issue no session id (nothing to close), and a server that does
   * not support client-initiated termination answers `405` — both are fine.
   */
  private closeHttpSession = async (server: THttpServer): Promise<void> => {
    if (!server.sessionId) return;
    try {
      await this.platformFetch(server.url, {
        method: "DELETE",
        headers: {
          ...server.headers,
          "Mcp-Session-Id": server.sessionId,
        },
      });
    } catch (error) {
      logger.info("[mcp] closeHttpSession failed (best-effort)", {
        url: server.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Record the `instructions` an `initialize` result carried, if any. The
   * entry is dropped when the field is absent or blank rather than left
   * alone, so a server that stops advertising instructions (or is
   * restarted against a different backend) doesn't keep injecting the
   * stale text into the system prompt.
   */
  private captureInstructions = (type: string, result: unknown) => {
    const text = (result as { instructions?: unknown } | undefined)
      ?.instructions;
    if (typeof text === "string" && text.trim().length > 0) {
      this.instructions[type] = text;
      logger.info("[mcp] initialize instructions captured", {
        type,
        length: text.length,
      });
      return;
    }
    delete this.instructions[type];
  };

  private _appendLog(type: string, line: string) {
    const logs = this.customServersLogs[type];
    if (!logs) return;
    logs.push(line);
    if (logs.length > MAX_LOG_LINES) {
      logs.splice(0, logs.length - MAX_LOG_LINES);
    }
  }

  onProcess = (type: string, t: number, message: string) => {
    logger.info("[mcp] onProcess", {
      type,
      stream: t === 0 ? "stdout" : t === 1 ? "stderr" : "exit",
      length: message?.length ?? 0,
      preview: typeof message === "string" ? message.slice(0, 200) : message,
    });
    if (t === 0) {
      for (const msg of this.consumeStdout(type, message)) {
        this.handleJsonRpcMessage(type, msg);
      }
    }

    const timestamp = new Date().toLocaleString();
    switch (t) {
      case 0: {
        this._appendLog(type, `${timestamp}: ${message}\n`);
        break;
      }
      case 1: {
        this._appendLog(type, `${timestamp}: ${message}\n`);
        break;
      }
      case 2: {
        this._appendLog(type, `${timestamp}: [stop] ${message}\n`);
        this.stoppedCustomServers.push(type);
        // A dead process answers nothing: drop the half-line it left behind
        // and any listing we were still waiting on, so the next start
        // begins from a clean slate.
        this.resetStdioState(type);
        break;
      }
      default:
        break;
    }
  };

  /**
   * Cut a stdout chunk into complete JSON-RPC messages. Lines end on `\n`
   * (stdio transport rule); the unterminated tail is either a message the
   * host delivered whole without a newline (the HTTP paths feed responses
   * through here that way, and some hosts trim lines) — parsed right away —
   * or a partial object kept for the next chunk. A tail that cannot be the
   * start of an object is a stray log line and is discarded, otherwise one
   * bad print would poison every message that follows it.
   */
  private consumeStdout = (type: string, chunk: string): JsonRpcMessage[] => {
    const combined = (this.stdoutBuffers[type] ?? "") + chunk;
    const lines = combined.split("\n");
    const tail = lines.pop() ?? "";
    const messages: JsonRpcMessage[] = [];

    for (const line of lines) {
      const parsed = this.parseJsonRpcLine(type, line);
      if (parsed) messages.push(parsed);
    }

    const trimmed = tail.trim();
    if (trimmed.length === 0) {
      this.stdoutBuffers[type] = "";
      return messages;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      this.stdoutBuffers[type] = "";
      if (isJsonRpcMessage(parsed)) messages.push(parsed);
      return messages;
    } catch {
      // Not (yet) a whole message.
    }

    if (trimmed.startsWith("{") && trimmed.length <= MAX_STDOUT_BUFFER) {
      this.stdoutBuffers[type] = tail;
    } else {
      this.stdoutBuffers[type] = "";
      logger.warn("[mcp] stdout line is not JSON-RPC, dropped", {
        type,
        length: tail.length,
        preview: tail.slice(0, 200),
      });
    }
    return messages;
  };

  private parseJsonRpcLine = (
    type: string,
    line: string
  ): JsonRpcMessage | null => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isJsonRpcMessage(parsed)) return parsed;
      logger.debug("[mcp] stdout JSON is not a JSON-RPC message", {
        type,
        preview: trimmed.slice(0, 200),
      });
    } catch (err) {
      logger.warn("[mcp] stdout line JSON.parse failed", {
        type,
        length: line.length,
        preview: line.slice(0, 200),
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  };

  /**
   * Route one message by JSON-RPC shape: `method` without `id` is a
   * notification from the server, `method` with `id` is a request the
   * server expects us to answer, anything else with an `id` is a response
   * to something we sent.
   */
  private handleJsonRpcMessage = (type: string, msg: JsonRpcMessage) => {
    const hasId = msg.id !== null && msg.id !== undefined;
    const method = typeof msg.method === "string" ? msg.method : null;

    if (method && !hasId) {
      this.handleNotification(type, method, msg.params);
      return;
    }
    if (method && hasId) {
      this.handleServerRequest(type, msg.id as string | number, method);
      return;
    }
    if (!hasId || msg.jsonrpc !== "2.0") return;

    const jsonId = String(msg.id);

    if (jsonId === `init-${type}` && msg.error) {
      // A refused `initialize` (e.g. mcp-go's "duplicate initialize
      // received" when the retry loop sent a second one before the first
      // was answered) is not a handshake. Treating it as one re-sent
      // `notifications/initialized` and, on a fresh process, would have
      // marked a server ready that never accepted us.
      logger.warn("[mcp] initialize rejected by server", {
        type,
        error: msg.error,
      });
    } else if (jsonId === `init-${type}`) {
      this.captureInstructions(type, msg.result);
      this.captureCapabilities(type, msg.result);
      this.initedCustomServers[type] = true;
      this.stoppedCustomServers = this.stoppedCustomServers.filter(
        (s) => s !== type
      );
      this.sendInitialized(type);
    }

    if (jsonId.startsWith(`tools-${type}`)) {
      this.handleToolsListResponse(type, msg);
    }

    // Dispatch to pending request resolvers
    const pending = this._pendingRequests.get(jsonId);
    if (pending) {
      this._pendingRequests.delete(jsonId);
      if (msg.error) {
        pending.reject(
          new Error(`MCP tool error (${msg.error.code}): ${msg.error.message}`)
        );
      } else {
        pending.resolve(serializeMcpToolResult(msg.result));
      }
    }
  };

  private handleToolsListResponse = (type: string, msg: JsonRpcMessage) => {
    const state = this.toolsRefresh[type];
    if (state) state.inFlight = false;

    const tools = (msg.result as { tools?: unknown } | undefined)?.tools;
    if (Array.isArray(tools)) {
      this.tools[type] = tools as TMCPItem[];
      this.listedCustomServers[type] = true;
      logger.info("[mcp] tools/list answered", { type, count: tools.length });
      this.eventBus.emit("tools-changed");
    } else {
      logger.warn("[mcp] tools/list answered without a tool array", {
        type,
        error: msg.error,
      });
      this.reinitializeAfterListingError(type, msg);
    }

    // A `list_changed` that landed while this listing was on the wire may
    // describe a catalog newer than the one just received — list once more.
    if (state?.queued) {
      state.queued = false;
      void this.getToolsFromMCP(type);
    }
  };

  /**
   * A `tools/list` refused with a JSON-RPC error on a stdio server almost
   * always means the session was never initialized from the server's point
   * of view — the process was restarted under a stale `inited` flag, or the
   * server dropped the session. Run the handshake again, once per process;
   * `initCustomServer` then re-issues `tools/list` on the new `initialize`
   * answer. A server that still refuses stays empty and its log shows why.
   */
  private reinitializeAfterListingError = (
    type: string,
    msg: JsonRpcMessage
  ) => {
    if (!msg.error || !this.customServersProcesses[type]) return;
    const state = (this.toolsRefresh[type] ??= {
      inFlight: false,
      queued: false,
    });
    if (state.reinitialized) return;
    state.reinitialized = true;
    logger.warn("[mcp] tools/list rejected — re-running initialize", {
      type,
      error: msg.error,
    });
    this.initedCustomServers[type] = false;
    this.initCustomServer(type);
  };

  /**
   * Notifications the server pushes on its own. Only the tools catalog is
   * acted on: `list_changed` carries no payload, it just marks the list
   * stale, so the reaction is a fresh `tools/list`. Prompts and resources
   * are not consumed by the widget, so their `list_changed` is only logged.
   */
  private handleNotification = (
    type: string,
    method: string,
    params: unknown
  ) => {
    switch (method) {
      case "notifications/tools/list_changed": {
        logger.info("[mcp] tools/list_changed received", { type });
        this.scheduleToolsRefresh(type);
        break;
      }
      case "notifications/prompts/list_changed":
      case "notifications/resources/list_changed":
      case "notifications/resources/updated":
      case "notifications/progress":
      case "notifications/message": {
        logger.debug("[mcp] notification ignored", { type, method, params });
        break;
      }
      default: {
        logger.debug("[mcp] unknown notification", { type, method });
        break;
      }
    }
  };

  /**
   * Requests the server sends *to* the client. `ping` gets its empty
   * result so a server that health-checks its client keeps the pipe open;
   * everything else (sampling, roots, elicitation) is unsupported here and
   * is answered with JSON-RPC "method not found" rather than left hanging,
   * since an unanswered request can block the server's own loop.
   */
  private handleServerRequest = (
    type: string,
    id: string | number,
    method: string
  ) => {
    const reply =
      method === "ping"
        ? { jsonrpc: "2.0", id, result: {} }
        : {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          };
    this.writeStdio(type, reply);
  };

  /**
   * Second half of the handshake. Until the client sends
   * `notifications/initialized` a compliant server holds back every
   * notification of its own, `tools/list_changed` included, so without
   * this the catalog would never refresh. Sent to stdio servers only —
   * the HTTP path negotiates its session in `initHttpServer`.
   */
  private sendInitialized = (type: string) => {
    if (!this.customServersProcesses[type]) return;
    this.writeStdio(type, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
  };

  private writeStdio = (type: string, message: unknown) => {
    const process = this.customServersProcesses[type];
    if (!process) return;
    try {
      process.stdin(`${JSON.stringify(message)}\n`);
    } catch (error) {
      logger.error(`[mcp] stdin write failed for ${type}:`, error);
    }
  };

  private captureCapabilities = (type: string, result: unknown) => {
    const capabilities = (
      result as { capabilities?: Record<string, unknown> } | undefined
    )?.capabilities;
    if (capabilities && typeof capabilities === "object") {
      this.serverCapabilities[type] = capabilities;
      const tools = capabilities.tools as { listChanged?: unknown } | undefined;
      logger.info("[mcp] server capabilities", {
        type,
        toolsListChanged: tools?.listChanged === true,
      });
      return;
    }
    delete this.serverCapabilities[type];
  };

  /**
   * Coalesce `list_changed` bursts into one `tools/list`. While a listing
   * is already in flight the refresh is queued behind it instead of being
   * sent in parallel, so answers can't land out of order and overwrite a
   * newer catalog with an older one.
   */
  private scheduleToolsRefresh = (type: string) => {
    if (!this.customServersProcesses[type]) return;
    const state = (this.toolsRefresh[type] ??= {
      inFlight: false,
      queued: false,
    });
    if (state.inFlight) {
      state.queued = true;
      return;
    }
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = undefined;
      void this.getToolsFromMCP(type);
    }, LIST_CHANGED_DEBOUNCE_MS);
  };

  /**
   * Forget everything tied to one stdio process: the partial stdout line,
   * the pending refresh timer and the in-flight/queued listing flags, plus
   * the "has listed" mark. Called on exit, restart and delete.
   */
  private resetStdioState = (type: string) => {
    delete this.stdoutBuffers[type];
    const state = this.toolsRefresh[type];
    if (state?.timer) clearTimeout(state.timer);
    delete this.toolsRefresh[type];
    delete this.listedCustomServers[type];
    delete this.serverCapabilities[type];
  };

  setCustomServers = (servers: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => {
    // When the host backend runs the registered servers itself, none of
    // them are this runtime's to start or list — their tools and permission
    // cards come back via `api.tools.listSystemTools`. Keeping the map here
    // would connect every server twice (browser + backend) and render a
    // duplicate card per server.
    if (this.platform.customServersExecutedByHost) {
      logger.info("[mcp] setCustomServers skipped — host executes them", {
        receivedKeys: Object.keys(servers?.mcpServers ?? {}),
      });
      this.customServers = {};
      // Nothing runs locally, so no started server will ever emit
      // `tools-changed` — fire it here so consumers refetch the system
      // listing after a config change (a removed server would otherwise
      // linger in the permission list, and a new one would spin forever).
      this.eventBus.emit("tools-changed");
      return;
    }
    // Keep only startable entries; non-startable markers are dropped here
    // so every consumer of the map (start, ready-wait, settings cards)
    // sees the same filtered set.
    const startable: Record<string, Record<string, unknown>> = {};
    const skipped: string[] = [];
    for (const [type, config] of Object.entries(servers?.mcpServers ?? {})) {
      if (isStartable(config)) {
        startable[type] = config;
      } else {
        skipped.push(type);
      }
    }
    logger.info("[mcp] setCustomServers", {
      receivedKeys: servers ? Object.keys(servers) : null,
      mcpServersType: typeof servers?.mcpServers,
      mcpServersKeys: servers?.mcpServers
        ? Object.keys(servers.mcpServers)
        : null,
      skippedNonStartable: skipped,
      raw: servers,
    });
    this.customServers = startable;
  };

  getServerType = (name: string) => {
    // Resolve by actual tool ownership — MCP servers expose their tool
    // names verbatim (no server-name prefix), so prefix-matching the
    // configured server keys (as `HostToolSource` does) misses every
    // MCP tool. Fall back to prefix-matching only if no live tool list
    // claims the name, so a tool-call that fires before `tools/list`
    // finishes still has a chance to route to the right server when
    // the model happens to use a prefixed name.
    for (const [serverType, tools] of Object.entries(this.tools)) {
      if (tools.some((t) => t.name === name)) {
        return serverType;
      }
    }
    const keys = Object.keys(this.customServers).sort(
      (a, b) => b.length - a.length
    );
    for (const serverType of keys) {
      if (name.startsWith(`${serverType}_`)) {
        return serverType;
      }
    }
    return "";
  };

  startCustomServers = () => {
    logger.info("[mcp] startCustomServers", {
      customServersType: typeof this.customServers,
      keys: this.customServers ? Object.keys(this.customServers) : null,
      processAdapterAvailable: !!this.platform.process,
      processIsAvailable: this.platform.process?.isAvailable?.() ?? null,
    });
    const servers: string[] = [];
    Object.entries(this.customServers).forEach(([type, config]) => {
      servers.push(type);

      const http = isHttpServer(config);
      logger.info("[mcp] startCustomServers → dispatch", {
        type,
        transport: http ? "http" : "stdio",
        configKeys: Object.keys(config ?? {}),
      });
      if (http) {
        this.startHttpServer(type, config);
      } else {
        this.startStdioServer(type, config);
      }
    });

    // remove deleted servers
    Object.keys(this.customServersProcesses).forEach((type) => {
      if (!servers.includes(type)) {
        this.deleteCustomServer(type);
      }
    });

    // remove deleted HTTP servers
    Object.keys(this.httpServers).forEach((type) => {
      if (!servers.includes(type)) {
        this.deleteCustomServer(type);
      }
    });
  };

  startHttpServer = (type: string, config: Record<string, unknown>) => {
    const { url, headers } = getHttpParams(config);
    logger.info("[mcp] startHttpServer", {
      type,
      url,
      headerKeys: headers ? Object.keys(headers) : null,
      alreadyStarted: this.startedCustomServers[type] === url,
    });

    if (this.startedCustomServers[type] === url) {
      logger.info("[mcp] startHttpServer skip — same url", { type });
      return;
    }

    // Stop existing HTTP server if running — close its MCP session first.
    const existing = this.httpServers[type];
    if (existing) {
      void this.closeHttpSession(existing);
      existing.abortController?.abort();
    }

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: HTTP MCP ${url}\n`,
    ];

    this.httpServers[type] = {
      url,
      headers,
      abortController: new AbortController(),
    };

    this.startedCustomServers[type] = url;
    this.initHttpServer(type);
  };

  startStdioServer = (type: string, config: Record<string, unknown>) => {
    const { commandLine, env } = getParams(config);
    logger.info("[mcp] startStdioServer", {
      type,
      commandLine,
      envKeys: Object.keys(env),
      alreadyStarted: this.startedCustomServers[type] === commandLine,
      processAdapter: !!this.platform.process,
    });

    if (
      this.startedCustomServers[type] &&
      this.startedCustomServers[type] === commandLine
    ) {
      logger.info("[mcp] startStdioServer skip — same commandLine", { type });
      return;
    }

    if (this.customServersProcesses[type]) {
      this.customServersProcesses[type].end();
      this.resetStdioState(type);
    }

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: ${commandLine}\n`,
    ];

    const process = this.platform.process?.createProcess(commandLine, env);
    if (!process) {
      logger.error(
        "[mcp] startStdioServer aborted — createProcess returned null/undefined",
        {
          type,
          commandLine,
          processAdapter: !!this.platform.process,
        }
      );
      return;
    }

    process.onprocess = this.onProcess.bind(this, type);

    this.customServersProcesses[type] = process;
    this.beginHandshake(type);

    logger.info("[mcp] startStdioServer → process.start()", { type });
    process.start();

    this.startedCustomServers[type] = commandLine;

    if (!hostSpawnSucceeded(process)) {
      // The host handed back a handle but no process behind it — the desktop
      // does this in frames that are not allowed to spawn (a settings page
      // iframe): `_createProcess` returns nothing and the handle's output
      // callback is keyed under `undefined`, so no answer can ever arrive.
      // Say so in the server log and mark it stopped, instead of thirty
      // unanswered `initialize` attempts behind a spinner.
      const where =
        (globalThis as { location?: { href?: string } }).location?.href ??
        "this frame";
      const hostId = (process as unknown as { id?: unknown }).id;
      logger.warn("[mcp] host refused to spawn the process", { type, where });
      this._appendLog(
        type,
        `${new Date().toLocaleString()}: [stop] host could not start the process from ${where} (process id: ${String(hostId)})\n`
      );
      this.stoppedCustomServers.push(type);
      this.eventBus.emit("tools-changed");
      return;
    }

    this.initCustomServer(type);
  };

  /**
   * Put a freshly spawned process in the "not yet initialized" state. Both
   * flags may carry stale values from the process that ran under this type
   * before: a leftover `inited` makes `initCustomServer` skip `initialize`
   * and send `tools/list` into a server that rejects it ("invalid during
   * session initialization"), and a leftover stop mark makes it give up
   * before the first `initialize` goes out. Either one leaves the card
   * spinning forever.
   */
  private beginHandshake = (type: string) => {
    this.initedCustomServers[type] = false;
    this.stoppedCustomServers = this.stoppedCustomServers.filter(
      (s) => s !== type
    );
  };

  restartCustomServer = (type: string) => {
    Object.entries(this.customServers).forEach(([serverType, config]) => {
      if (type !== serverType) return;

      if (isHttpServer(config)) {
        this.restartHttpServer(type, config);
      } else {
        this.restartStdioServer(type, config);
      }
    });
  };

  restartHttpServer = (type: string, config: Record<string, unknown>) => {
    // Stop existing connection — close its MCP session first.
    const existing = this.httpServers[type];
    if (existing) {
      void this.closeHttpSession(existing);
      existing.abortController?.abort();
    }

    const { url, headers } = getHttpParams(config);

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: HTTP MCP ${url}\n`,
    ];

    this.tools[type] = [];
    delete this.instructions[type];
    this.initedCustomServers[type] = false;

    this.httpServers[type] = {
      url,
      headers,
      abortController: new AbortController(),
    };

    this.initHttpServer(type);
    this.eventBus.emit("tools-changed");
  };

  restartStdioServer = (type: string, config: Record<string, unknown>) => {
    this.customServersProcesses[type].end();
    this.resetStdioState(type);

    const { commandLine, env } = getParams(config);

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: ${commandLine}\n`,
    ];

    this.tools[type] = [];
    delete this.instructions[type];

    const process = this.platform.process?.createProcess(commandLine, env);
    if (!process) return;

    process.onprocess = this.onProcess.bind(this, type);

    this.customServersProcesses[type] = process;
    this.beginHandshake(type);

    process.start();

    this.initCustomServer(type);
    this.eventBus.emit("tools-changed");
  };

  deleteCustomServer = (type: string) => {
    // Stop stdio process if exists
    if (this.customServersProcesses[type]) {
      this.customServersProcesses[type].end();
      delete this.customServersProcesses[type];
    }
    this.resetStdioState(type);
    delete this.initedCustomServers[type];
    // Stop HTTP connection if exists — terminate the MCP session (best-effort
    // DELETE) before dropping the connection so it is not orphaned server-side.
    const httpServer = this.httpServers[type];
    if (httpServer) {
      void this.closeHttpSession(httpServer);
      httpServer.abortController?.abort();
      delete this.httpServers[type];
    }
    if (this.customServersLogs[type]) {
      delete this.customServersLogs[type];
    }
    if (this.startedCustomServers[type]) {
      delete this.startedCustomServers[type];
    }
    if (this.customServers[type]) {
      delete this.customServers[type];
    }
    if (this.tools[type]) {
      delete this.tools[type];
    }
    delete this.instructions[type];
    this.eventBus.emit("tools-changed");
  };

  /**
   * Per-server `initialize` instructions for the servers running right
   * now, keyed by server type. Feeds `actionArgs.toolInstructions`.
   */
  getInstructions = (): Record<string, string> => {
    return { ...this.instructions };
  };

  /**
   * Tear down every running server: terminate stdio child processes and
   * close HTTP MCP sessions (best-effort `DELETE`). Meant to be called on
   * widget unmount — otherwise child processes and stateful sessions are
   * orphaned for the lifetime of the host page. Also fails any in-flight
   * stdio tool calls so their promises settle instead of hanging until the
   * 30s timeout.
   */
  dispose = () => {
    const types = new Set([
      ...Object.keys(this.customServersProcesses),
      ...Object.keys(this.httpServers),
    ]);
    types.forEach((type) => this.deleteCustomServer(type));

    this._pendingRequests.forEach((pending) =>
      pending.reject(new Error("MCP client disposed"))
    );
    this._pendingRequests.clear();
  };

  initHttpServer = async (type: string) => {
    const server = this.httpServers[type];
    if (!server) return;

    try {
      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: `init-${type}`,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          clientInfo,
        },
      };

      const response = await this.platformFetch(server.url, {
        method: "POST",
        headers: this.httpHeaders(server),
        body: JSON.stringify(initRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Capture the session id for stateful (Streamable HTTP) servers so
      // later requests echo it and teardown can close the session.
      const sessionId = response.headers?.get?.("Mcp-Session-Id");
      if (sessionId) {
        server.sessionId = sessionId;
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(type, 0, JSON.stringify(result));

        const msg = result as {
          jsonrpc?: string;
          id?: string;
          result?: unknown;
        };
        if (msg.jsonrpc === "2.0" && msg.id?.includes(`init-${type}`)) {
          this.captureInstructions(type, msg.result);
          this.initedCustomServers[type] = true;
          this.stoppedCustomServers = this.stoppedCustomServers.filter(
            (s) => s !== type
          );
          await this.getToolsFromHttpMCP(type);
          return;
        }
      }
    } catch (error) {
      logger.error(`Error initializing HTTP MCP server ${type}:`, error);
      this.onProcess(type, 2, `Connection failed: ${error}`);
    }
  };

  initCustomServer = (type: string) => {
    const process = this.customServersProcesses[type];

    if (!process) {
      logger.warn("[mcp] initCustomServer skipped — no process", { type });
      return;
    }

    let retries = 0;
    const maxRetries = 30;
    logger.info("[mcp] initCustomServer start", { type, maxRetries });

    const interval = setInterval(() => {
      if (this.initedCustomServers[type]) {
        logger.info("[mcp] initCustomServer → inited, fetching tools", {
          type,
          afterRetries: retries,
        });
        clearInterval(interval);
        this.getToolsFromMCP(type);
        return;
      }

      if (
        this.stoppedCustomServers.includes(type) ||
        !this.customServersProcesses[type] ||
        retries >= maxRetries
      ) {
        logger.warn("[mcp] initCustomServer giving up", {
          type,
          retries,
          stopped: this.stoppedCustomServers.includes(type),
          processGone: !this.customServersProcesses[type],
          exhausted: retries >= maxRetries,
        });
        clearInterval(interval);
        return;
      }

      retries++;

      try {
        const initRequest = {
          jsonrpc: "2.0",
          id: `init-${type}`,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            clientInfo,
          },
        };

        const initBody = JSON.stringify(initRequest);
        const initMessage = `${initBody}\n`;

        logger.info("[mcp] initCustomServer → stdin(initialize)", {
          type,
          attempt: retries,
        });
        process.stdin(initMessage);
      } catch (error) {
        logger.error(`Error initializing custom server ${type}:`, error);
        clearInterval(interval);
      }
    }, 1000);
  };

  getToolsFromHttpMCP = async (type: string) => {
    const server = this.httpServers[type];
    if (!server) return;

    try {
      const request = {
        jsonrpc: "2.0",
        id: `tools-${type}-${this.nextRequestId()}`,
        method: "tools/list",
        params: {},
      };

      const response = await this.platformFetch(server.url, {
        method: "POST",
        headers: this.httpHeaders(server),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(type, 0, JSON.stringify(result));
      }
    } catch (error) {
      logger.error(`Error getting tools from HTTP MCP server ${type}:`, error);
    }
  };

  getToolsFromMCP = async (type: string) => {
    // Get all running custom server processes

    const process = this.customServersProcesses[type];

    try {
      // Create JSON-RPC request for tools/list
      const request = {
        jsonrpc: "2.0",
        id: `tools-${type}-${this.nextRequestId()}`,
        method: "tools/list",
        params: {},
      };

      const requestBody = JSON.stringify(request);
      const requestMessage = `${requestBody}\n`;

      const state = (this.toolsRefresh[type] ??= {
        inFlight: false,
        queued: false,
      });
      state.inFlight = true;
      process.stdin(requestMessage);
    } catch (error) {
      const state = this.toolsRefresh[type];
      if (state) state.inFlight = false;
      logger.error(`Error getting tools from MCP server ${type}:`, error);
    }
  };

  callToolFromMCP = async (
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    // Check if it's an HTTP server
    if (this.httpServers[serverType]) {
      return this.callToolFromHttpMCP(serverType, toolName, args);
    }

    // Otherwise use stdio
    return this.callToolFromStdioMCP(serverType, toolName, args);
  };

  callToolFromHttpMCP = async (
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const server = this.httpServers[serverType];

    if (!server) {
      throw new Error(`HTTP MCP server ${serverType} is not running`);
    }

    // Check if tool exists
    const serverTools = this.tools[serverType] || [];
    const tool = serverTools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverType}`);
    }

    try {
      const request = {
        jsonrpc: "2.0",
        id: `call-${serverType}-${toolName}-${Date.now()}`,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const response = await this.platformFetch(server.url, {
        method: "POST",
        headers: this.httpHeaders(server),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(serverType, 0, JSON.stringify(result));

        const msg = result as {
          error?: { code: number; message: string };
          result?: unknown;
        };

        if (msg.error) {
          throw new Error(
            `MCP tool error (${msg.error.code}): ${msg.error.message}`
          );
        }

        if (msg.result !== undefined) {
          return serializeMcpToolResult(msg.result);
        }
      }

      throw new Error("No result in response");
    } catch (error) {
      throw new Error(
        `Error calling HTTP MCP tool ${toolName} on server ${serverType}: ${error}`
      );
    }
  };

  callToolFromStdioMCP = async (
    serverType: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const process = this.customServersProcesses[serverType];

    if (!process) {
      throw new Error(`MCP server ${serverType} is not running`);
    }

    // Check if tool exists and get its schema
    const serverTools = this.tools[serverType] || [];
    const tool = serverTools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverType}`);
    }

    const requestId = `call-${serverType}-${toolName}-${Date.now()}-${crypto.randomUUID()}`;

    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const requestBody = JSON.stringify(request);
    const requestMessage = `${requestBody}\n`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(requestId);
        reject(
          new Error(`Timeout waiting for tool response from ${serverType}`)
        );
      }, 30000);

      this._pendingRequests.set(requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason);
        },
      });

      process.stdin(requestMessage);
    });
  };

  getTools = () => {
    return this.tools;
  };

  /**
   * Resolve once every configured custom server has either yielded its
   * `tools/list` response OR transitioned to `stoppedCustomServers`
   * (init failure / process exit). Bounded by `timeoutMs` so a hung
   * server can never block a send indefinitely — after the deadline
   * we resolve regardless and let the caller proceed with whatever
   * tools have arrived so far.
   *
   * "Yielded" means an answered listing (`listedCustomServers`), not a
   * non-empty tool array: a server may list zero tools, and a
   * `list_changed` refresh may empty a list that was full a moment ago.
   * The tool-count check stays as a fallback for tool maps filled in by
   * hand (tests, hosts poking the holder) that never went through a
   * listing.
   *
   * Subscribes to the `tools-changed` event bus so we don't poll —
   * each tools/list response and each stop transition emits, and we
   * re-evaluate on every emit.
   */
  waitUntilReady = (timeoutMs = 3000): Promise<void> => {
    const expected = Object.keys(this.customServers);
    if (expected.length === 0) return Promise.resolve();

    const isReady = () =>
      expected.every(
        (type) =>
          this.listedCustomServers[type] === true ||
          (this.tools[type]?.length ?? 0) > 0 ||
          this.stoppedCustomServers.includes(type)
      );

    if (isReady()) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        this.eventBus.off("tools-changed", onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        if (isReady()) settle();
      };
      this.eventBus.on("tools-changed", onChange);
      const timer = setTimeout(() => {
        logger.warn("[mcp] waitUntilReady timeout", {
          expected,
          ready: expected.filter(
            (t) =>
              this.listedCustomServers[t] === true ||
              (this.tools[t]?.length ?? 0) > 0 ||
              this.stoppedCustomServers.includes(t)
          ),
          timeoutMs,
        });
        settle();
      }, timeoutMs);
    });
  };
}

export { CustomServers };
