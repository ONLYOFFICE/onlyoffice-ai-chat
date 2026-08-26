import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../../app-context";
import type { CallbacksManager } from "../../providers/EventsProvider";
import type { ServerAPI } from "../../providers/ApiProvider";
import { createServersStore } from "../create-servers-store";

function makeDeps(overrides?: {
  grouped?: Record<string, { name: string; enabled?: boolean }[]>;
  disabled?: Record<string, string[]>;
  webSearchEnabled?: boolean;
  systemTools?: Record<string, { name: string; enabled?: boolean }[]>;
}) {
  const grouped = overrides?.grouped ?? {};
  const disabled = overrides?.disabled ?? {};
  const webSearchEnabled = overrides?.webSearchEnabled ?? false;
  const systemTools = overrides?.systemTools ?? {};

  const servers = {
    getTools: vi.fn().mockResolvedValue(grouped),
    getServerType: vi.fn((name: string) => `type-${name}`),
    callTools: vi.fn().mockResolvedValue("call-result"),
    startCustomServers: vi.fn(),
    setCustomServers: vi.fn(),
    deleteCustomServer: vi.fn(),
    getCustomServersLogs: vi.fn(() => ({ a: ["log"] })),
    waitUntilCustomServersReady: vi.fn().mockResolvedValue(undefined),
  };

  const ctx = { servers } as unknown as AppContext;

  const api = {
    tools: {
      getDisabled: vi.fn().mockResolvedValue(disabled),
      setDisabled: vi.fn().mockResolvedValue(undefined),
      listCustomServers: vi.fn().mockResolvedValue({ a: { command: "x" } }),
      listSystemTools: vi.fn().mockResolvedValue(systemTools),
      replaceAllCustomServers: vi.fn().mockResolvedValue(undefined),
      removeCustomServer: vi.fn().mockResolvedValue(undefined),
    },
    webSearch: {
      isConfigured: vi.fn().mockResolvedValue(webSearchEnabled),
    },
  } as unknown as ServerAPI;

  const callbacksManager = { emit: vi.fn() } as unknown as CallbacksManager;
  return { ctx, api, callbacksManager, servers };
}

describe("createServersStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with empty state", () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    const st = s.getState();
    expect(st.servers).toEqual({});
    expect(st.tools).toEqual([]);
    expect(st.disabledTools).toEqual({});
    expect(st.webSearchEnabled).toBe(false);
    expect(st.manageToolData).toBeUndefined();
  });

  it("initServers starts custom servers", async () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    await s.getState().initServers();
    expect(deps.servers.startCustomServers).toHaveBeenCalled();
  });

  it("initServers reports a failed config read on onError", async () => {
    const deps = makeDeps();
    const failure = new Error("offline");
    deps.api.tools.listCustomServers = vi.fn().mockRejectedValue(failure);
    const s = createServersStore(deps);

    await expect(s.getState().initServers()).resolves.toBeUndefined();

    expect(deps.callbacksManager.emit).toHaveBeenCalledWith("onError", {
      type: "storage",
      error: failure,
      context: "servers:init",
    });
    expect(deps.servers.startCustomServers).not.toHaveBeenCalled();
  });

  it("getTools reports a failed tool fetch on onError", async () => {
    const deps = makeDeps();
    const failure = new Error("offline");
    deps.servers.getTools = vi.fn().mockRejectedValue(failure);
    const s = createServersStore(deps);

    await expect(s.getState().getTools()).resolves.toBeUndefined();

    expect(deps.callbacksManager.emit).toHaveBeenCalledWith("onError", {
      type: "storage",
      error: failure,
      context: "tools:list",
    });
    expect(s.getState().tools).toEqual([]);
  });

  it("getTools annotates servers with serverType and the enabled flag", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "a" }, { name: "b" }] },
      disabled: { mcp: ["b"] },
      webSearchEnabled: true,
    });
    const s = createServersStore(deps);
    await s.getState().getTools();
    // Cards show every tool with its flag...
    expect(s.getState().servers.mcp).toEqual([
      { name: "a", serverType: "mcp", enabled: true },
      { name: "b", serverType: "mcp", enabled: false },
    ]);
    // ...while `tools` — the counter's enabled-only view, also shipped by
    // the resume rounds — excludes the disabled "b".
    expect(s.getState().tools.map((t) => t.name)).toEqual(["a"]);
    expect(s.getState().disabledTools).toEqual({ mcp: ["b"] });
    expect(s.getState().webSearchEnabled).toBe(true);
  });

  it("getTools keeps system tools in servers/systemTools but out of tools", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "client_tool" }] },
      systemTools: { docspace: [{ name: "getmy_folder" }] },
    });
    const s = createServersStore(deps);
    await s.getState().getTools();
    const st = s.getState();
    // Cards see the system server...
    expect(st.servers.docspace.map((t) => t.name)).toEqual(["getmy_folder"]);
    expect(st.systemTools.docspace.map((t) => t.name)).toEqual(["getmy_folder"]);
    // ...but `tools` must NOT list it — the engine injects and executes
    // system tools server-side.
    expect(st.tools.map((t) => t.name)).toEqual(["client_tool"]);
  });

  it("getTools preserves explicit enabled flag", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "a", enabled: false }] },
      disabled: { mcp: [] },
    });
    const s = createServersStore(deps);
    await s.getState().getTools();
    expect(s.getState().servers.mcp[0].enabled).toBe(false);
  });

  it("getUserTools tags every tool with its serverType and hits no API", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "a" }], editor: [{ name: "insert_text" }] },
      disabled: { mcp: ["a"] },
    });
    const s = createServersStore(deps);

    const tools = await s.getState().getUserTools();

    expect(tools).toEqual([
      { name: "a", serverType: "mcp" },
      { name: "insert_text", serverType: "editor" },
    ]);
    // The disabled map is deliberately NOT applied here — `buildToolContext`
    // does it engine-side, so a toggle flipped elsewhere lands immediately.
    expect(deps.api.tools.getDisabled).not.toHaveBeenCalled();
    expect(deps.api.tools.listSystemTools).not.toHaveBeenCalled();
    expect(deps.api.webSearch.isConfigured).not.toHaveBeenCalled();
  });

  it("getUserTools waits for still-connecting MCP servers", async () => {
    const deps = makeDeps({ grouped: { mcp: [{ name: "a" }] } });
    const order: string[] = [];
    deps.servers.waitUntilCustomServersReady = vi.fn(async () => {
      order.push("wait");
    });
    deps.servers.getTools = vi.fn(async () => {
      order.push("getTools");
      return { mcp: [{ name: "a" }] };
    });
    const s = createServersStore(deps);

    await s.getState().getUserTools();

    expect(order).toEqual(["wait", "getTools"]);
  });

  it("getUserTools preserves an explicit enabled: false for the engine to drop", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "a", enabled: false }] },
    });
    const s = createServersStore(deps);

    expect(await s.getState().getUserTools()).toEqual([
      { name: "a", enabled: false, serverType: "mcp" },
    ]);
  });

  it("reload restarts custom servers and refreshes tools", async () => {
    const deps = makeDeps({ grouped: { mcp: [{ name: "a" }] } });
    const s = createServersStore(deps);
    await s.getState().reload();
    expect(deps.servers.startCustomServers).toHaveBeenCalled();
    expect(s.getState().tools).toHaveLength(1);
  });

  it("changeToolStatus disables tool", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "a" }] },
      disabled: {},
    });
    const s = createServersStore(deps);
    await s.getState().changeToolStatus("mcp", "a", false);
    expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
      "mcp",
      ["a"],
      undefined
    );
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
      "onServersUpdated",
      {
        kind: "tool-toggled",
        toolType: "mcp",
        toolName: "a",
        enabled: false,
      }
    );
  });

  it("changeToolStatus re-enables tool", async () => {
    const deps = makeDeps({
      grouped: { mcp: [{ name: "a" }] },
      disabled: { mcp: ["a", "b"] },
    });
    const s = createServersStore(deps);
    s.setState({ disabledTools: { mcp: ["a", "b"] } });
    await s.getState().changeToolStatus("mcp", "a", true);
    expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
      "mcp",
      ["b"],
      undefined
    );
  });

  it("changeToolStatus disables multiple tools atomically (array)", async () => {
    const deps = makeDeps({
      grouped: { "web-search": [] },
      disabled: {},
    });
    const s = createServersStore(deps);
    await s
      .getState()
      .changeToolStatus("web-search", ["web_search", "web_crawling"], false);
    // Single persist with BOTH names — no per-tool race that drops one.
    expect(deps.api.tools.setDisabled).toHaveBeenCalledTimes(1);
    expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
      "web-search",
      ["web_search", "web_crawling"],
      undefined
    );
    expect(s.getState().disabledTools["web-search"]).toEqual([
      "web_search",
      "web_crawling",
    ]);
    // Multi-tool flip omits `toolName`.
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith("onServersUpdated", {
      kind: "tool-toggled",
      toolType: "web-search",
      enabled: false,
    });
  });

  it("changeToolStatus dedupes when disabling already-disabled tool", async () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    s.setState({ disabledTools: { mcp: ["a"] } });
    await s.getState().changeToolStatus("mcp", "a", false);
    expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
      "mcp",
      ["a"],
      undefined
    );
  });

  describe("changeToolStatus — optimistic local update", () => {
    it("flips enabled flag locally without re-fetching disabled / webSearch / host tools", async () => {
      const deps = makeDeps({
        grouped: {
          mcp: [
            { name: "a", enabled: true },
            { name: "b", enabled: true },
          ],
        },
        disabled: {},
      });
      const s = createServersStore(deps);
      // Seed initial state via getTools, then clear call counters.
      await s.getState().getTools();
      vi.clearAllMocks();

      await s.getState().changeToolStatus("mcp", "a", false);

      expect(deps.api.tools.setDisabled).toHaveBeenCalledTimes(1);
      expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
        "mcp",
        ["a"],
        undefined
      );
      // Refactor target: do NOT rebuild the whole tool tree on toggle.
      expect(deps.api.tools.getDisabled).not.toHaveBeenCalled();
      expect(deps.api.webSearch.isConfigured).not.toHaveBeenCalled();
      expect(deps.servers.getTools).not.toHaveBeenCalled();

      const st = s.getState();
      expect(st.disabledTools).toEqual({ mcp: ["a"] });
      expect(st.servers.mcp).toEqual([
        { name: "a", serverType: "mcp", enabled: false },
        { name: "b", serverType: "mcp", enabled: true },
      ]);
      // The disabled tool is dropped from the model payload; "b" stays.
      expect(st.tools.map((t) => t.name)).toEqual(["b"]);
    });

    it("re-enables a tool by removing it from disabledTools and flipping its flag", async () => {
      const deps = makeDeps({
        grouped: {
          mcp: [
            { name: "a", enabled: false },
            { name: "b", enabled: true },
          ],
        },
        disabled: { mcp: ["a"] },
      });
      const s = createServersStore(deps);
      await s.getState().getTools();
      vi.clearAllMocks();

      await s.getState().changeToolStatus("mcp", "a", true);

      expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
        "mcp",
        [],
        undefined
      );
      expect(deps.api.tools.getDisabled).not.toHaveBeenCalled();
      expect(deps.servers.getTools).not.toHaveBeenCalled();

      const st = s.getState();
      expect(st.disabledTools).toEqual({ mcp: [] });
      expect(st.servers.mcp.find((t) => t.name === "a")?.enabled).toBe(true);
      // Re-enabling adds it back into the enabled-only view (it was
      // filtered out at build time while disabled).
      expect(st.tools.map((t) => t.name)).toEqual(["a", "b"]);
    });

    it("changeAllToolStatus disables every tool of a type in one persist", async () => {
      const deps = makeDeps({
        grouped: {
          mcp: [
            { name: "a", enabled: true },
            { name: "b", enabled: true },
          ],
        },
        disabled: {},
      });
      const s = createServersStore(deps);
      await s.getState().getTools();
      vi.clearAllMocks();

      await s.getState().changeAllToolStatus("mcp", false);

      // Single persist with the full name list — not one call per tool.
      expect(deps.api.tools.setDisabled).toHaveBeenCalledTimes(1);
      expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
        "mcp",
        ["a", "b"],
        undefined
      );

      const st = s.getState();
      expect(st.disabledTools).toEqual({ mcp: ["a", "b"] });
      expect(st.servers.mcp).toEqual([
        { name: "a", serverType: "mcp", enabled: false },
        { name: "b", serverType: "mcp", enabled: false },
      ]);
      // All disabled → the enabled-only view is empty.
      expect(st.tools).toEqual([]);
    });

    it("changeAllToolStatus enables every tool of a type in one persist", async () => {
      const deps = makeDeps({
        grouped: {
          mcp: [
            { name: "a", enabled: false },
            { name: "b", enabled: false },
          ],
        },
        disabled: { mcp: ["a", "b"] },
      });
      const s = createServersStore(deps);
      await s.getState().getTools();
      vi.clearAllMocks();

      await s.getState().changeAllToolStatus("mcp", true);

      expect(deps.api.tools.setDisabled).toHaveBeenCalledTimes(1);
      expect(deps.api.tools.setDisabled).toHaveBeenCalledWith(
        "mcp",
        [],
        undefined
      );

      const st = s.getState();
      expect(st.disabledTools).toEqual({ mcp: [] });
      expect(st.tools.map((t) => t.name)).toEqual(["a", "b"]);
    });

    it("emits tool-toggled callback after optimistic update", async () => {
      const deps = makeDeps({
        grouped: { mcp: [{ name: "a", enabled: true }] },
        disabled: {},
      });
      const s = createServersStore(deps);
      await s.getState().getTools();
      vi.clearAllMocks();

      await s.getState().changeToolStatus("mcp", "a", false);

      expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
        "onServersUpdated",
        {
          kind: "tool-toggled",
          toolType: "mcp",
          toolName: "a",
          enabled: false,
        }
      );
    });
  });

  it("callTools resolves server type and dispatches", async () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    const out = await s.getState().callTools("foo", { x: 1 });
    expect(deps.servers.getServerType).toHaveBeenCalledWith("foo");
    expect(deps.servers.callTools).toHaveBeenCalledWith("type-foo", "foo", {
      x: 1,
    });
    expect(out).toBe("call-result");
  });

  it("setManageToolData sets and clears", () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    const data = { threadId: "t", message: {}, idx: 0, messageId: "m" };
    s.getState().setManageToolData(
      data as unknown as Parameters<
        ReturnType<typeof s.getState>["setManageToolData"]
      >[0]
    );
    expect(s.getState().manageToolData).toEqual(data);
    s.getState().setManageToolData(undefined);
    expect(s.getState().manageToolData).toBeUndefined();
  });

  it("getConfig delegates to api.tools.listCustomServers", async () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    const cfg = await s.getState().getConfig();
    expect(cfg).toEqual({ a: { command: "x" } });
  });

  it("saveConfig writes via api and notifies servers", async () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    const config = { mcpServers: { a: { command: "x" } } };
    await s.getState().saveConfig(config);
    expect(deps.api.tools.replaceAllCustomServers).toHaveBeenCalledWith(
      config.mcpServers,
      undefined
    );
    expect(deps.servers.setCustomServers).toHaveBeenCalledWith(config);
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
      "onServersUpdated",
      { kind: "config-saved" }
    );
  });

  it("deleteCustomServer removes via api and runtime", async () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    await s.getState().deleteCustomServer("foo");
    expect(deps.api.tools.removeCustomServer).toHaveBeenCalledWith(
      "foo",
      undefined
    );
    expect(deps.servers.deleteCustomServer).toHaveBeenCalledWith("foo");
    expect(deps.callbacksManager.emit).toHaveBeenCalledWith(
      "onServersUpdated",
      { kind: "server-deleted", serverName: "foo" }
    );
  });

  it("getCustomServersLogs delegates", () => {
    const deps = makeDeps();
    const s = createServersStore(deps);
    expect(s.getState().getCustomServersLogs()).toEqual({ a: ["log"] });
  });

  it("getWebSearchEnabled delegates", async () => {
    const deps = makeDeps({ webSearchEnabled: true });
    const s = createServersStore(deps);
    expect(await s.getState().getWebSearchEnabled()).toBe(true);
  });
});
