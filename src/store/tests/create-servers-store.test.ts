import { describe, expect, it, vi, beforeEach } from "vitest";
import { CallbacksManager } from "../../events/callbacks";
import type { ServersService } from "../../services/servers";
import { createServersStore } from "../create-servers-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(overrides?: Partial<ServersService>): ServersService {
  return {
    initServers: vi.fn(),
    buildToolsList: vi.fn().mockResolvedValue({
      tools: [],
      servers: {},
      disabledTools: {},
      webSearchEnabled: false,
    }),
    changeToolStatus: vi.fn().mockReturnValue({
      tools: [],
      servers: {},
      disabledTools: {},
      webSearchEnabled: false,
    }),
    callTools: vi.fn().mockResolvedValue("result"),
    checkAllowAlways: vi.fn().mockReturnValue(false),
    setAllowAlways: vi.fn(),
    getConfig: vi.fn().mockReturnValue({}),
    saveConfig: vi.fn(),
    deleteCustomServer: vi.fn(),
    getCustomServersLogs: vi.fn().mockReturnValue({}),
    getWebSearchEnabled: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as ServersService;
}

describe("createServersStore", () => {
  let service: ServersService;
  let callbacksManager: CallbacksManager;

  const makeStore = (s: ServersService = service) =>
    createServersStore({ serversService: s, callbacksManager });

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
    callbacksManager = new CallbacksManager();
  });

  it("starts with empty state", () => {
    const store = makeStore();
    const state = store.getState();
    expect(state.servers).toEqual({});
    expect(state.tools).toEqual([]);
    expect(state.disabledTools).toEqual({});
    expect(state.webSearchEnabled).toBe(false);
    expect(state.manageToolData).toBeUndefined();
  });

  describe("initServers", () => {
    it("delegates to service", () => {
      const store = makeStore();
      store.getState().initServers();
      expect(service.initServers).toHaveBeenCalled();
    });
  });

  describe("getTools", () => {
    it("fetches and sets tools from service", async () => {
      const tools = [{ name: "tool1", description: "d", inputSchema: {} }];
      service = makeService({
        buildToolsList: vi.fn().mockResolvedValue({
          tools,
          servers: { custom: tools },
          disabledTools: { custom: ["tool1"] },
          webSearchEnabled: true,
        }),
      } as unknown as Partial<ServersService>);
      const store = makeStore();

      await store.getState().getTools();

      expect(store.getState().tools).toEqual(tools);
      expect(store.getState().servers).toEqual({ custom: tools });
      expect(store.getState().disabledTools).toEqual({ custom: ["tool1"] });
      expect(store.getState().webSearchEnabled).toBe(true);
    });
  });

  describe("changeToolStatus", () => {
    it("updates state from service result", () => {
      const result = {
        tools: [{ name: "t", description: "d", inputSchema: {} }],
        servers: {},
        disabledTools: {},
        webSearchEnabled: true,
      };
      service = makeService({
        changeToolStatus: vi.fn().mockReturnValue(result),
      } as unknown as Partial<ServersService>);
      const store = makeStore();

      store.getState().changeToolStatus("custom", "t", true);
      expect(store.getState().webSearchEnabled).toBe(true);
    });

    it("does not update state if service returns null", () => {
      service = makeService({
        changeToolStatus: vi.fn().mockReturnValue(null),
      } as unknown as Partial<ServersService>);
      const store = makeStore();

      store.getState().changeToolStatus("custom", "t", true);
      expect(store.getState().tools).toEqual([]);
    });
  });

  describe("callTools", () => {
    it("delegates to service with disabledTools", async () => {
      const store = makeStore();
      const result = await store.getState().callTools("fn", { x: 1 });
      expect(service.callTools).toHaveBeenCalledWith("fn", { x: 1 }, {});
      expect(result).toBe("result");
    });
  });

  describe("checkAllowAlways / setAllowAlways", () => {
    it("checks via service", () => {
      const store = makeStore();
      store.getState().checkAllowAlways("custom", "tool");
      expect(service.checkAllowAlways).toHaveBeenCalledWith("custom", "tool");
    });

    it("sets via service", () => {
      const store = makeStore();
      store.getState().setAllowAlways(true, "custom", "tool");
      expect(service.setAllowAlways).toHaveBeenCalledWith(
        true,
        "custom",
        "tool"
      );
    });
  });

  describe("setManageToolData", () => {
    it("sets and clears manage tool data", () => {
      const store = makeStore();
      const data = {
        message: { role: "assistant" as const, content: [] },
        idx: 0,
        messageUID: "uid-1",
      };
      store.getState().setManageToolData(data);
      expect(store.getState().manageToolData).toEqual(data);
      store.getState().setManageToolData(undefined);
      expect(store.getState().manageToolData).toBeUndefined();
    });
  });

  describe("saveConfig / getConfig", () => {
    it("delegates to service", () => {
      const store = makeStore();
      store.getState().saveConfig({ mcpServers: { s: {} } });
      expect(service.saveConfig).toHaveBeenCalledWith({
        mcpServers: { s: {} },
      });
      store.getState().getConfig();
      expect(service.getConfig).toHaveBeenCalled();
    });
  });

  describe("deleteCustomServer", () => {
    it("delegates to service", () => {
      const store = makeStore();
      store.getState().deleteCustomServer("my-server");
      expect(service.deleteCustomServer).toHaveBeenCalledWith("my-server");
    });
  });

  describe("getCustomServersLogs", () => {
    it("returns logs from service", () => {
      service = makeService({
        getCustomServersLogs: vi.fn().mockReturnValue({ s: ["log1"] }),
      } as unknown as Partial<ServersService>);
      const store = makeStore();
      expect(store.getState().getCustomServersLogs()).toEqual({ s: ["log1"] });
    });
  });

  describe("getWebSearchEnabled", () => {
    it("delegates to service", () => {
      service = makeService({
        getWebSearchEnabled: vi.fn().mockReturnValue(true),
      } as unknown as Partial<ServersService>);
      const store = makeStore();
      expect(store.getState().getWebSearchEnabled()).toBe(true);
    });
  });

  describe("reload", () => {
    it("calls initServers and buildToolsList, then sets state", async () => {
      const tools = [{ name: "t", description: "d", inputSchema: {} }];
      service = makeService({
        buildToolsList: vi.fn().mockResolvedValue({
          tools,
          servers: { s1: tools },
          disabledTools: {},
          webSearchEnabled: true,
        }),
      } as unknown as Partial<ServersService>);
      const store = makeStore();

      await store.getState().reload();

      expect(service.initServers).toHaveBeenCalled();
      expect(service.buildToolsList).toHaveBeenCalled();
      expect(store.getState().tools).toEqual(tools);
      expect(store.getState().webSearchEnabled).toBe(true);
    });
  });

  describe("onServersUpdated callback", () => {
    it("fires on saveConfig with kind=config-saved", () => {
      const onServersUpdated = vi.fn();
      callbacksManager.setCallbacks({ onServersUpdated });
      const store = makeStore();
      store.getState().saveConfig({ mcpServers: {} });
      expect(onServersUpdated).toHaveBeenCalledTimes(1);
      expect(onServersUpdated).toHaveBeenCalledWith({ kind: "config-saved" });
    });

    it("fires on deleteCustomServer with kind=server-deleted", () => {
      const onServersUpdated = vi.fn();
      callbacksManager.setCallbacks({ onServersUpdated });
      const store = makeStore();
      store.getState().deleteCustomServer("my-server");
      expect(onServersUpdated).toHaveBeenCalledWith({
        kind: "server-deleted",
        serverName: "my-server",
      });
    });

    it("fires on changeToolStatus with kind=tool-toggled", () => {
      const onServersUpdated = vi.fn();
      callbacksManager.setCallbacks({ onServersUpdated });
      service = makeService({
        changeToolStatus: vi.fn().mockReturnValue({
          tools: [],
          servers: {},
          disabledTools: {},
          webSearchEnabled: false,
        }),
      } as unknown as Partial<ServersService>);
      const store = makeStore();
      store.getState().changeToolStatus("custom", "search", false);
      expect(onServersUpdated).toHaveBeenCalledWith({
        kind: "tool-toggled",
        toolType: "custom",
        toolName: "search",
        enabled: false,
      });
    });

    it("does NOT fire on changeToolStatus when service returns null", () => {
      const onServersUpdated = vi.fn();
      callbacksManager.setCallbacks({ onServersUpdated });
      service = makeService({
        changeToolStatus: vi.fn().mockReturnValue(null),
      } as unknown as Partial<ServersService>);
      const store = makeStore();
      store.getState().changeToolStatus("custom", "search", true);
      expect(onServersUpdated).not.toHaveBeenCalled();
    });

    it("fires on setAllowAlways with kind=tool-auto-approve-changed", () => {
      const onServersUpdated = vi.fn();
      callbacksManager.setCallbacks({ onServersUpdated });
      const store = makeStore();
      store.getState().setAllowAlways(true, "custom", "tool");
      expect(onServersUpdated).toHaveBeenCalledWith({
        kind: "tool-auto-approve-changed",
        toolType: "custom",
        toolName: "tool",
        allowAlways: true,
      });
    });
  });
});
