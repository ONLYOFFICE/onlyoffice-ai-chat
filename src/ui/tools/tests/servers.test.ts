import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEventBus } from "../../providers/EventsProvider";
import type { PlatformAdapter } from "../../providers/PlatformProvider/types";
import type { TMCPItem } from "../../../types";

const mockPlatform = {
  file: null,
  process: null,
  env: {
    theme: "light",
    systemTheme: "light",
    locale: "en",
    devicePixelRatio: 1,
  },
  hostTools: null,
  clouds: null,
} as unknown as PlatformAdapter;

const mockEventBus = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
} as unknown as ChatEventBus;

const mockHostToolSource = {
  getGroupIds: vi.fn().mockReturnValue([]),
  getToolsByGroup: vi.fn().mockResolvedValue({}),
  callTool: vi.fn().mockResolvedValue("host-result"),
  setGroups: vi.fn(),
  getGroupDisplayName: vi.fn().mockReturnValue("Display"),
};

const mockCustomServers = {
  getTools: vi.fn().mockResolvedValue({}),
  callToolFromMCP: vi.fn().mockResolvedValue("custom-result"),
  getServerType: vi.fn().mockReturnValue("my-server"),
  setCustomServers: vi.fn(),
  startCustomServers: vi.fn(),
  restartCustomServer: vi.fn(),
  deleteCustomServer: vi.fn(),
  customServers: { foo: { command: "x" } },
  stoppedCustomServers: ["bar"],
  customServersLogs: { foo: ["log1"] },
};

vi.mock("../sources/HostToolSource", () => ({
  HostToolSource: class {
    constructor() {
      return mockHostToolSource;
    }
  },
}));

vi.mock("../sources/CustomServers", () => ({
  CustomServers: class {
    constructor() {
      return mockCustomServers;
    }
  },
}));

import Servers from "../servers";

describe("Servers", () => {
  let servers: Servers;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHostToolSource.getGroupIds.mockReturnValue([]);
    mockHostToolSource.getToolsByGroup.mockResolvedValue({});
    mockCustomServers.getTools.mockResolvedValue({});
    servers = new Servers(mockPlatform, mockEventBus);
  });

  describe("getTools", () => {
    it("aggregates tools from host and custom sources", async () => {
      const hostTools: Record<string, TMCPItem[]> = {
        "desktop-editor": [
          { name: "read_file", description: "Read", inputSchema: {} },
        ],
      };
      const customTools: Record<string, TMCPItem[]> = {
        "my-mcp": [
          { name: "custom_tool", description: "Custom", inputSchema: {} },
        ],
      };

      mockHostToolSource.getToolsByGroup.mockResolvedValue(hostTools);
      mockCustomServers.getTools.mockResolvedValue(customTools);

      const result = await servers.getTools();

      expect(result).toEqual({
        "desktop-editor": hostTools["desktop-editor"],
        "my-mcp": customTools["my-mcp"],
      });
    });
  });

  describe("callTools", () => {
    it("routes to hostToolSource for host group", async () => {
      mockHostToolSource.getGroupIds.mockReturnValue(["desktop-editor"]);
      const result = await servers.callTools("desktop-editor", "read_file", {
        path: "/test",
      });
      expect(mockHostToolSource.callTool).toHaveBeenCalledWith("read_file", {
        path: "/test",
      });
      expect(result).toBe("host-result");
    });

    it("routes to customServers for non-host types", async () => {
      const result = await servers.callTools("my-mcp", "custom_tool", {
        arg: "val",
      });
      expect(mockCustomServers.callToolFromMCP).toHaveBeenCalledWith(
        "my-mcp",
        "custom_tool",
        { arg: "val" }
      );
      expect(result).toBe("custom-result");
    });
  });

  describe("getServerType", () => {
    it("returns host group id when name has host group prefix", () => {
      mockHostToolSource.getGroupIds.mockReturnValue(["desktop-editor"]);
      const result = servers.getServerType("desktop-editor_read_file");
      expect(result).toBe("desktop-editor");
    });

    it("falls through to customServers for non-host names", () => {
      mockCustomServers.getServerType.mockReturnValue("my-mcp");
      const result = servers.getServerType("my-mcp_custom_tool");
      expect(result).toBe("my-mcp");
      expect(mockCustomServers.getServerType).toHaveBeenCalledWith(
        "my-mcp_custom_tool"
      );
    });
  });

  describe("custom server delegations", () => {
    it("setCustomServers delegates", () => {
      servers.setCustomServers({ mcpServers: {} });
      expect(mockCustomServers.setCustomServers).toHaveBeenCalled();
    });

    it("startCustomServers delegates", () => {
      servers.startCustomServers();
      expect(mockCustomServers.startCustomServers).toHaveBeenCalled();
    });

    it("restartCustomServer delegates", () => {
      servers.restartCustomServer("my-mcp");
      expect(mockCustomServers.restartCustomServer).toHaveBeenCalledWith(
        "my-mcp"
      );
    });

    it("deleteCustomServer delegates", () => {
      servers.deleteCustomServer("my-mcp");
      expect(mockCustomServers.deleteCustomServer).toHaveBeenCalledWith(
        "my-mcp"
      );
    });
  });

  describe("host tool group accessors", () => {
    it("getHostToolGroupIds delegates to hostToolSource.getGroupIds", () => {
      mockHostToolSource.getGroupIds.mockReturnValue(["a", "b"]);
      expect(servers.getHostToolGroupIds()).toEqual(["a", "b"]);
      expect(mockHostToolSource.getGroupIds).toHaveBeenCalled();
    });

    it("getHostToolGroupDisplayName delegates with the group id", () => {
      mockHostToolSource.getGroupDisplayName.mockReturnValue("My Group");
      expect(servers.getHostToolGroupDisplayName("grp")).toBe("My Group");
      expect(mockHostToolSource.getGroupDisplayName).toHaveBeenCalledWith(
        "grp"
      );
    });
  });

  describe("custom server state accessors", () => {
    it("getCustomServers exposes underlying customServers map", () => {
      expect(servers.getCustomServers()).toBe(mockCustomServers.customServers);
    });

    it("getCustomServersStoped exposes stopped list", () => {
      expect(servers.getCustomServersStoped()).toBe(
        mockCustomServers.stoppedCustomServers
      );
    });

    it("getCustomServersLogs exposes logs map", () => {
      expect(servers.getCustomServersLogs()).toBe(
        mockCustomServers.customServersLogs
      );
    });
  });
});
