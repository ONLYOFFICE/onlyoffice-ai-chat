import type { ChatEventBus } from "../../providers/EventsProvider";
import logger from "../../../shared/logger";
import type { PlatformAdapter } from "../../providers/PlatformProvider/types";
import type { TMCPItem, TProcess } from "../../../types";

type THttpServer = {
  url: string;
  headers?: Record<string, string>;
  abortController?: AbortController;
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

class CustomServers {
  customServers: Record<string, Record<string, unknown>>;
  startedCustomServers: Record<string, string>;
  initedCustomServers: Record<string, boolean>;
  stoppedCustomServers: string[];
  customServersProcesses: Record<string, TProcess>;
  httpServers: Record<string, THttpServer>;
  customServersLogs: Record<string, string[]>;
  tools: Record<string, TMCPItem[]>;
  private _pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >;
  private platform: PlatformAdapter;
  private eventBus: ChatEventBus;

  constructor(platform: PlatformAdapter, eventBus: ChatEventBus) {
    this.platform = platform;
    this.eventBus = eventBus;
    this.customServers = {};
    this.startedCustomServers = {};
    this.initedCustomServers = {};
    this.customServersProcesses = {};
    this.httpServers = {};
    this.customServersLogs = {};
    this.tools = {};
    this.stoppedCustomServers = [];
    this._pendingRequests = new Map();
  }

  /** Use platform fetchProxy if available, otherwise standard fetch */
  private platformFetch = (
    url: string,
    init?: RequestInit
  ): Promise<Response> => {
    const proxy = this.platform.fetchProxy;
    return proxy ? proxy(url, init) : fetch(url, init);
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
      // stdout — parse JSON-RPC responses
      try {
        const correctJson = JSON.parse(message);
        const jsonId =
          correctJson.jsonrpc === "2.0" &&
          correctJson.id !== null &&
          correctJson.id !== undefined
            ? String(correctJson.id)
            : null;

        if (jsonId && jsonId === `init-${type}`) {
          this.initedCustomServers[type] = true;
          this.stoppedCustomServers = this.stoppedCustomServers.filter(
            (s) => s !== type
          );
        }

        if (jsonId && jsonId.startsWith(`tools-${type}`)) {
          this.tools[type] = correctJson.result.tools;
          this.eventBus.emit("tools-changed");
        }

        // Dispatch to pending request resolvers
        if (jsonId && this._pendingRequests.has(jsonId)) {
          const pending = this._pendingRequests.get(jsonId)!;
          this._pendingRequests.delete(jsonId);
          if (correctJson.error) {
            pending.reject(
              new Error(
                `MCP tool error (${correctJson.error.code}): ${correctJson.error.message}`
              )
            );
          } else {
            pending.resolve(JSON.stringify(correctJson.result));
          }
        }
      } catch (err) {
        logger.warn("[mcp] onProcess stdout JSON.parse failed", {
          type,
          length: message?.length ?? 0,
          preview: typeof message === "string" ? message.slice(0, 200) : message,
          error: err instanceof Error ? err.message : String(err),
        });
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
        break;
      }
      default:
        break;
    }
  };

  setCustomServers = (servers: {
    mcpServers: Record<string, Record<string, unknown>>;
  }) => {
    logger.info("[mcp] setCustomServers", {
      receivedKeys: servers ? Object.keys(servers) : null,
      mcpServersType: typeof servers?.mcpServers,
      mcpServersKeys: servers?.mcpServers
        ? Object.keys(servers.mcpServers)
        : null,
      raw: servers,
    });
    this.customServers = servers.mcpServers;
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

    // Stop existing HTTP server if running
    if (this.httpServers[type]?.abortController) {
      this.httpServers[type].abortController.abort();
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
    }

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: ${commandLine}\n`,
    ];

    const process = this.platform.process?.createProcess(commandLine, env);
    if (!process) {
      logger.error("[mcp] startStdioServer aborted — createProcess returned null/undefined", {
        type,
        commandLine,
        processAdapter: !!this.platform.process,
      });
      return;
    }

    process.onprocess = this.onProcess.bind(this, type);

    this.customServersProcesses[type] = process;

    logger.info("[mcp] startStdioServer → process.start()", { type });
    process.start();

    this.startedCustomServers[type] = commandLine;
    this.initCustomServer(type);
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
    // Stop existing connection
    if (this.httpServers[type]?.abortController) {
      this.httpServers[type].abortController.abort();
    }

    const { url, headers } = getHttpParams(config);

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: HTTP MCP ${url}\n`,
    ];

    this.tools[type] = [];
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

    const { commandLine, env } = getParams(config);

    this.customServersLogs[type] = [
      `${new Date().toLocaleString()}: ${commandLine}\n`,
    ];

    this.tools[type] = [];

    const process = this.platform.process?.createProcess(commandLine, env);
    if (!process) return;

    process.onprocess = this.onProcess.bind(this, type);

    this.customServersProcesses[type] = process;

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
    // Stop HTTP connection if exists
    if (this.httpServers[type]) {
      if (this.httpServers[type].abortController) {
        this.httpServers[type].abortController.abort();
      }
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
    this.eventBus.emit("tools-changed");
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
        headers: {
          "Content-Type": "application/json",
          ...server.headers,
        },
        body: JSON.stringify(initRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const results = parseSSEResponse(text);

      for (const result of results) {
        this.onProcess(type, 0, JSON.stringify(result));

        const msg = result as { jsonrpc?: string; id?: string };
        if (msg.jsonrpc === "2.0" && msg.id?.includes(`init-${type}`)) {
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
        id: `tools-${type}-${Date.now()}`,
        method: "tools/list",
        params: {},
      };

      const response = await this.platformFetch(server.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...server.headers,
        },
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
        id: `tools-${type}-${Date.now()}`,
        method: "tools/list",
        params: {},
      };

      const requestBody = JSON.stringify(request);
      const requestMessage = `${requestBody}\n`;

      process.stdin(requestMessage);
    } catch (error) {
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
        headers: {
          "Content-Type": "application/json",
          ...server.headers,
        },
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
          return JSON.stringify(msg.result);
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
