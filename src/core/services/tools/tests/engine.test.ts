import { describe, expect, it, vi } from "vitest";
import type { McpServerConfig } from "../../../storage";
import type { StorageAdapter } from "../../../storage";
import { ToolsEngine } from "../engine";

function makeStorage(seed: {
  servers?: Record<string, McpServerConfig>;
  disabled?: Record<string, string[]>;
  allow?: string[];
} = {}) {
  let servers: Record<string, McpServerConfig> = { ...(seed.servers ?? {}) };
  let disabled: Record<string, string[]> = { ...(seed.disabled ?? {}) };
  let allow: string[] = [...(seed.allow ?? [])];

  const storage = {
    mcpServers: {
      create: vi.fn(async (name: string, c: McpServerConfig) => {
        servers[name] = c;
      }),
      readByName: vi.fn(async (name: string) => servers[name] ?? null),
      readAll: vi.fn(async () => ({ ...servers })),
      update: vi.fn(async (name: string, c: McpServerConfig) => {
        servers[name] = c;
      }),
      replaceAll: vi.fn(async (m: Record<string, McpServerConfig>) => {
        servers = { ...m };
      }),
      delete: vi.fn(async (name: string) => {
        delete servers[name];
      }),
    },
    toolPrefs: {
      readDisabled: vi.fn(async () => ({ ...disabled })),
      upsertDisabled: vi.fn(async (d: Record<string, string[]>) => {
        disabled = { ...d };
      }),
      readAllowAlways: vi.fn(async () => [...allow]),
      upsertAllowAlways: vi.fn(async (l: string[]) => {
        allow = [...l];
      }),
    },
  } as unknown as StorageAdapter;

  return {
    storage,
    snapshot: () => ({
      servers: { ...servers },
      disabled: { ...disabled },
      allow: [...allow],
    }),
  };
}

describe("ToolsEngine custom server CRUD", () => {
  it("addCustomServer rejects bad name", async () => {
    const { storage } = makeStorage();
    const engine = new ToolsEngine({ storage });
    const r = await engine.addCustomServer("with_underscore", {
      url: "http://x",
    });
    expect(r.success).toBe(false);
  });

  it("addCustomServer rejects bad config", async () => {
    const { storage } = makeStorage();
    const engine = new ToolsEngine({ storage });
    const r = await engine.addCustomServer("good", {});
    expect(r.success).toBe(false);
  });

  it("addCustomServer rejects duplicate name", async () => {
    const { storage } = makeStorage({
      servers: { exists: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    const r = await engine.addCustomServer("exists", { url: "http://x" });
    expect(r.success).toBe(false);
  });

  it("addCustomServer succeeds", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    const r = await engine.addCustomServer("good", { url: "http://x" });
    expect(r.success).toBe(true);
    expect(snapshot().servers.good).toEqual({ url: "http://x" });
  });

  it("updateCustomServer rejects when missing", async () => {
    const { storage } = makeStorage();
    const engine = new ToolsEngine({ storage });
    const r = await engine.updateCustomServer("missing", {
      url: "http://x",
    });
    expect(r.success).toBe(false);
  });

  it("updateCustomServer rejects bad config", async () => {
    const { storage } = makeStorage({
      servers: { good: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    const r = await engine.updateCustomServer("good", {});
    expect(r.success).toBe(false);
  });

  it("updateCustomServer succeeds", async () => {
    const { storage, snapshot } = makeStorage({
      servers: { good: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    const r = await engine.updateCustomServer("good", { url: "http://y" });
    expect(r.success).toBe(true);
    expect(snapshot().servers.good).toEqual({ url: "http://y" });
  });

  it("removeCustomServer + getCustomServer + listCustomServers", async () => {
    const { storage, snapshot } = makeStorage({
      servers: { a: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    expect(await engine.getCustomServer("a")).toEqual({ url: "http://x" });
    expect(await engine.listCustomServers()).toEqual({
      a: { url: "http://x" },
    });
    await engine.removeCustomServer("a");
    expect(snapshot().servers).toEqual({});
  });

  it("replaceAllCustomServers reports per-key errors and writes nothing", async () => {
    const { storage, snapshot } = makeStorage({
      servers: { existing: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    const r = await engine.replaceAllCustomServers({
      good: { url: "http://x" },
      bad_name: { url: "http://x" },
      empty: {},
    });
    expect(r.success).toBe(false);
    if (r.success) throw new Error();
    expect(r.errors.length).toBe(2);
    expect(snapshot().servers).toEqual({ existing: { url: "http://x" } });
  });

  it("replaceAllCustomServers replaces atomically when all valid", async () => {
    const { storage, snapshot } = makeStorage({
      servers: { existing: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    const r = await engine.replaceAllCustomServers({
      a: { url: "http://x" },
      b: { command: "node" },
    });
    expect(r.success).toBe(true);
    expect(snapshot().servers).toEqual({
      a: { url: "http://x" },
      b: { command: "node" },
    });
  });
});

describe("ToolsEngine disabled tools", () => {
  it("setDisabled with non-empty list adds to map", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.setDisabled("web-search", ["t1", "t2"]);
    expect(snapshot().disabled).toEqual({ "web-search": ["t1", "t2"] });
  });

  it("setDisabled with empty list removes the entry", async () => {
    const { storage, snapshot } = makeStorage({
      disabled: { "web-search": ["t1"] },
    });
    const engine = new ToolsEngine({ storage });
    await engine.setDisabled("web-search", []);
    expect(snapshot().disabled["web-search"]).toBeUndefined();
  });

  it("getDisabled passes through", async () => {
    const { storage } = makeStorage({
      disabled: { x: ["a"] },
    });
    const engine = new ToolsEngine({ storage });
    expect(await engine.getDisabled()).toEqual({ x: ["a"] });
  });

  it("isToolDisabled reflects the stored list", async () => {
    const { storage } = makeStorage({
      disabled: { mcp: ["t1"] },
    });
    const engine = new ToolsEngine({ storage });
    expect(await engine.isToolDisabled("mcp", "t1")).toBe(true);
    expect(await engine.isToolDisabled("mcp", "t2")).toBe(false);
    expect(await engine.isToolDisabled("other", "t1")).toBe(false);
  });
});

describe("ToolsEngine allow-always", () => {
  it("setAllowAlways(true) appends a token when missing", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.setAllowAlways("mcp", "tool1", true);
    expect(snapshot().allow).toEqual(["mcp_tool1"]);
  });

  it("setAllowAlways(true) is a no-op when already present", async () => {
    const { storage, snapshot } = makeStorage({
      allow: ["mcp_tool1"],
    });
    const engine = new ToolsEngine({ storage });
    await engine.setAllowAlways("mcp", "tool1", true);
    expect(snapshot().allow).toEqual(["mcp_tool1"]);
    expect(storage.toolPrefs.upsertAllowAlways).not.toHaveBeenCalled();
  });

  it("setAllowAlways(false) removes a token when present", async () => {
    const { storage, snapshot } = makeStorage({
      allow: ["mcp_tool1", "mcp_tool2"],
    });
    const engine = new ToolsEngine({ storage });
    await engine.setAllowAlways("mcp", "tool1", false);
    expect(snapshot().allow).toEqual(["mcp_tool2"]);
  });

  it("setAllowAlways(false) is a no-op when absent", async () => {
    const { storage, snapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.setAllowAlways("mcp", "tool1", false);
    expect(snapshot().allow).toEqual([]);
    expect(storage.toolPrefs.upsertAllowAlways).not.toHaveBeenCalled();
  });

  it("getAllowAlways + isAllowAlways", async () => {
    const { storage } = makeStorage({ allow: ["a_b"] });
    const engine = new ToolsEngine({ storage });
    expect(await engine.getAllowAlways()).toEqual(["a_b"]);
    expect(await engine.isAllowAlways("a", "b")).toBe(true);
    expect(await engine.isAllowAlways("a", "c")).toBe(false);
  });
});
