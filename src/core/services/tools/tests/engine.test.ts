import { describe, expect, it, vi } from "vitest";
import type { McpServerConfig } from "../../../storage";
import type { StorageAdapter } from "../../../storage";
import { ToolsEngine } from "../engine";

type Scope = {
  servers: Record<string, McpServerConfig>;
  disabled: Record<string, string[]>;
  allow: string[];
};

function makeStorage(
  seed: {
    servers?: Record<string, McpServerConfig>;
    disabled?: Record<string, string[]>;
    allow?: string[];
    /** Per-entity scopes — independent of the global one. */
    entityScopes?: Record<string, Partial<Scope>>;
  } = {}
) {
  const global: Scope = {
    servers: { ...(seed.servers ?? {}) },
    disabled: { ...(seed.disabled ?? {}) },
    allow: [...(seed.allow ?? [])],
  };
  const entities: Record<string, Scope> = {};
  for (const [k, v] of Object.entries(seed.entityScopes ?? {})) {
    entities[k] = {
      servers: { ...(v.servers ?? {}) },
      disabled: { ...(v.disabled ?? {}) },
      allow: [...(v.allow ?? [])],
    };
  }

  const scopeFor = (entityId?: string): Scope => {
    if (entityId === undefined) return global;
    if (!entities[entityId]) {
      entities[entityId] = { servers: {}, disabled: {}, allow: [] };
    }
    return entities[entityId];
  };

  const storage = {
    mcpServers: {
      create: vi.fn(
        async (name: string, c: McpServerConfig, entityId?: string) => {
          scopeFor(entityId).servers[name] = c;
        }
      ),
      readByName: vi.fn(
        async (name: string, entityId?: string) =>
          scopeFor(entityId).servers[name] ?? null
      ),
      readAll: vi.fn(async (entityId?: string) => ({
        ...scopeFor(entityId).servers,
      })),
      update: vi.fn(
        async (name: string, c: McpServerConfig, entityId?: string) => {
          scopeFor(entityId).servers[name] = c;
        }
      ),
      replaceAll: vi.fn(
        async (m: Record<string, McpServerConfig>, entityId?: string) => {
          scopeFor(entityId).servers = { ...m };
        }
      ),
      delete: vi.fn(async (name: string, entityId?: string) => {
        delete scopeFor(entityId).servers[name];
      }),
    },
    toolPrefs: {
      readDisabled: vi.fn(async (entityId?: string) => ({
        ...scopeFor(entityId).disabled,
      })),
      upsertDisabled: vi.fn(
        async (d: Record<string, string[]>, entityId?: string) => {
          scopeFor(entityId).disabled = { ...d };
        }
      ),
      readAllowAlways: vi.fn(async (entityId?: string) => [
        ...scopeFor(entityId).allow,
      ]),
      upsertAllowAlways: vi.fn(async (l: string[], entityId?: string) => {
        scopeFor(entityId).allow = [...l];
      }),
    },
  } as unknown as StorageAdapter;

  return {
    storage,
    snapshot: () => ({
      servers: { ...global.servers },
      disabled: { ...global.disabled },
      allow: [...global.allow],
    }),
    entitySnapshot: (entityId: string): Scope | undefined =>
      entities[entityId]
        ? {
            servers: { ...entities[entityId].servers },
            disabled: { ...entities[entityId].disabled },
            allow: [...entities[entityId].allow],
          }
        : undefined,
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

  it("replaceAllCustomServers rejects keys differing only by case (Bug 82984)", async () => {
    // Name lookups are case-insensitive downstream, so such a pair would
    // collide on every read while both rows persist — reject up front.
    const { storage, snapshot } = makeStorage({
      servers: { existing: { url: "http://x" } },
    });
    const engine = new ToolsEngine({ storage });
    const r = await engine.replaceAllCustomServers({
      "Autotest-Dup": { url: "http://a" },
      "autotest-dup": { url: "http://b" },
    });
    expect(r.success).toBe(false);
    if (r.success) throw new Error();
    expect(r.errors).toEqual([
      {
        name: "autotest-dup",
        error: {
          field: "name",
          message:
            "Duplicate server name (names are case-insensitive): autotest-dup",
        },
      },
    ]);
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

  it("allow-always is scoped to the server, not the bare tool name", async () => {
    // A permission granted on one server must not leak onto a same-named
    // tool of another server (DocSpace bug 83161).
    const { storage } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.setAllowAlways("github", "search", true);
    expect(await engine.isAllowAlways("github", "search")).toBe(true);
    expect(await engine.isAllowAlways("jira", "search")).toBe(false);
    await engine.setAllowAlways("jira", "search", false);
    expect(await engine.isAllowAlways("github", "search")).toBe(true);
  });
});

describe("ToolsEngine entity scope", () => {
  it("addCustomServer + listCustomServers persist into the requested scope", async () => {
    const { storage, snapshot, entitySnapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.addCustomServer("e-only", { url: "http://x" }, "e1");
    expect(snapshot().servers).toEqual({});
    expect(entitySnapshot("e1")?.servers).toEqual({
      "e-only": { url: "http://x" },
    });
    expect(await engine.listCustomServers("e1")).toEqual({
      "e-only": { url: "http://x" },
    });
    expect(await engine.listCustomServers()).toEqual({});
  });

  it("same server name can coexist across scopes without colliding", async () => {
    const { storage } = makeStorage();
    const engine = new ToolsEngine({ storage });
    const a = await engine.addCustomServer("foo", { url: "http://a" }, "e1");
    const b = await engine.addCustomServer("foo", { url: "http://b" }, "e2");
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(await engine.getCustomServer("foo", "e1")).toEqual({
      url: "http://a",
    });
    expect(await engine.getCustomServer("foo", "e2")).toEqual({
      url: "http://b",
    });
    expect(await engine.getCustomServer("foo")).toBeNull();
  });

  it("setDisabled + getDisabled scope independently", async () => {
    const { storage, snapshot, entitySnapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.setDisabled("mcp", ["a"], "e1");
    expect(snapshot().disabled).toEqual({});
    expect(entitySnapshot("e1")?.disabled).toEqual({ mcp: ["a"] });
    expect(await engine.getDisabled("e1")).toEqual({ mcp: ["a"] });
    expect(await engine.getDisabled()).toEqual({});
  });

  it("isToolDisabled honors entity scope", async () => {
    const { storage } = makeStorage({
      entityScopes: { e1: { disabled: { mcp: ["a"] } } },
    });
    const engine = new ToolsEngine({ storage });
    expect(await engine.isToolDisabled("mcp", "a", "e1")).toBe(true);
    expect(await engine.isToolDisabled("mcp", "a")).toBe(false);
  });

  it("setAllowAlways + isAllowAlways scope independently", async () => {
    const { storage, snapshot, entitySnapshot } = makeStorage();
    const engine = new ToolsEngine({ storage });
    await engine.setAllowAlways("mcp", "tool1", true, "e1");
    expect(snapshot().allow).toEqual([]);
    expect(entitySnapshot("e1")?.allow).toEqual(["mcp_tool1"]);
    expect(await engine.isAllowAlways("mcp", "tool1", "e1")).toBe(true);
    expect(await engine.isAllowAlways("mcp", "tool1")).toBe(false);
  });

  it("removeCustomServer only deletes from the requested scope", async () => {
    const { storage, entitySnapshot, snapshot } = makeStorage({
      servers: { foo: { url: "http://global" } },
      entityScopes: { e1: { servers: { foo: { url: "http://entity" } } } },
    });
    const engine = new ToolsEngine({ storage });
    await engine.removeCustomServer("foo", "e1");
    expect(entitySnapshot("e1")?.servers).toEqual({});
    expect(snapshot().servers).toEqual({ foo: { url: "http://global" } });
  });

  it("replaceAllCustomServers replaces only the requested scope", async () => {
    const { storage, entitySnapshot, snapshot } = makeStorage({
      servers: { keep: { url: "http://keep" } },
    });
    const engine = new ToolsEngine({ storage });
    await engine.replaceAllCustomServers(
      { newOne: { url: "http://new" } },
      "e1"
    );
    expect(entitySnapshot("e1")?.servers).toEqual({
      newOne: { url: "http://new" },
    });
    expect(snapshot().servers).toEqual({ keep: { url: "http://keep" } });
  });
});

describe("ToolsEngine.listSystemTools", () => {
  it("delegates to the injected system source", async () => {
    const { storage } = makeStorage();
    const tools = { sysA: [{ name: "a", description: "", inputSchema: {} }] };
    const engine = new ToolsEngine({
      storage,
      systemToolsSource: { getTools: vi.fn().mockResolvedValue(tools) },
    });
    expect(await engine.listSystemTools()).toEqual(tools);
  });

  it("returns {} when no system source is wired", async () => {
    const { storage } = makeStorage();
    const engine = new ToolsEngine({ storage });
    expect(await engine.listSystemTools()).toEqual({});
  });
});
