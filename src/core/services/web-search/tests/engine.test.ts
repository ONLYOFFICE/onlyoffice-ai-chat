import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter, WebSearchConfig } from "../../../storage";
import { WebSearchEngine } from "../engine";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeStorage(seed: {
  config?: WebSearchConfig | null;
  entityConfigs?: Record<string, WebSearchConfig | null>;
} = {}) {
  let stored: WebSearchConfig | null = seed.config ?? null;
  const entityStored: Record<string, WebSearchConfig | null> = {
    ...(seed.entityConfigs ?? {}),
  };
  const storage = {
    webSearch: {
      read: vi.fn(async (entityId?: string) =>
        entityId !== undefined ? (entityStored[entityId] ?? null) : stored
      ),
      upsert: vi.fn(async (c: WebSearchConfig, entityId?: string) => {
        if (entityId !== undefined) entityStored[entityId] = c;
        else stored = c;
      }),
      delete: vi.fn(async (entityId?: string) => {
        if (entityId !== undefined) delete entityStored[entityId];
        else stored = null;
      }),
    },
  } as unknown as StorageAdapter;
  return {
    storage,
    get current() {
      return stored;
    },
    entityStored,
  };
}

describe("WebSearchEngine.getActiveConfig + isConfigured", () => {
  it("returns the stored config and true when configured", async () => {
    const { storage } = makeStorage({
      config: { provider: "Exa", key: "k" },
    });
    const engine = new WebSearchEngine({ storage });
    expect(await engine.getActiveConfig()).toEqual({
      provider: "Exa",
      key: "k",
    });
    expect(await engine.isConfigured()).toBe(true);
  });

  it("returns null and false when not configured", async () => {
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    expect(await engine.getActiveConfig()).toBeNull();
    expect(await engine.isConfigured()).toBe(false);
  });
});

describe("WebSearchEngine.testConnection", () => {
  it("delegates to live validation", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    const result = await engine.testConnection({ provider: "Exa", key: "k" });
    expect(result).toBe(true);
  });
});

describe("WebSearchEngine.configure", () => {
  it("does not persist when validation fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    const result = await engine.configure({ provider: "Exa", key: "bad" });
    expect(result.success).toBe(false);
    expect(storage.webSearch.upsert).not.toHaveBeenCalled();
  });

  it("persists on success", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    const result = await engine.configure({ provider: "Exa", key: "k" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error();
    expect(result.config).toEqual({ provider: "Exa", key: "k" });
    expect(storage.webSearch.upsert).toHaveBeenCalledWith(
      { provider: "Exa", key: "k" },
      undefined
    );
  });
});

describe("WebSearchEngine.clear", () => {
  it("calls delete only when something is configured", async () => {
    const { storage } = makeStorage({
      config: { provider: "Exa", key: "k" },
    });
    const engine = new WebSearchEngine({ storage });
    await engine.clear();
    expect(storage.webSearch.delete).toHaveBeenCalled();
  });

  it("is a no-op when nothing is configured", async () => {
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    await engine.clear();
    expect(storage.webSearch.delete).not.toHaveBeenCalled();
  });
});

describe("WebSearchEngine entity scope", () => {
  it("forwards entityId to storage.webSearch.read", async () => {
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    await engine.getActiveConfig("e1");
    expect(storage.webSearch.read).toHaveBeenCalledWith("e1");
  });

  it("returns the entity-specific config when storage scopes by entityId", async () => {
    const global: WebSearchConfig = { provider: "Exa", key: "g" };
    const room: WebSearchConfig = { provider: "ONLYOFFICE", key: "r" };
    const { storage } = makeStorage({
      config: global,
      entityConfigs: { e1: room },
    });
    const engine = new WebSearchEngine({ storage });
    expect(await engine.getActiveConfig()).toEqual(global);
    expect(await engine.getActiveConfig("e1")).toEqual(room);
  });

  it("isConfigured honors entity scope independently", async () => {
    const { storage } = makeStorage({
      entityConfigs: { e1: { provider: "Exa", key: "k" } },
    });
    const engine = new WebSearchEngine({ storage });
    expect(await engine.isConfigured()).toBe(false);
    expect(await engine.isConfigured("e1")).toBe(true);
    expect(await engine.isConfigured("e2")).toBe(false);
  });

  it("configure persists into the requested scope", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const { storage } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    await engine.configure({ provider: "Exa", key: "k" }, "e1");
    expect(storage.webSearch.upsert).toHaveBeenCalledWith(
      { provider: "Exa", key: "k" },
      "e1"
    );
  });

  it("setActiveConfig persists into the requested scope", async () => {
    const { storage, entityStored } = makeStorage();
    const engine = new WebSearchEngine({ storage });
    await engine.setActiveConfig({ provider: "Exa", key: "k" }, "e1");
    expect(entityStored.e1).toEqual({ provider: "Exa", key: "k" });
  });

  it("clear removes only the entity-scoped config", async () => {
    const { storage, entityStored } = makeStorage({
      config: { provider: "Exa", key: "g" },
      entityConfigs: { e1: { provider: "ONLYOFFICE", key: "r" } },
    });
    const engine = new WebSearchEngine({ storage });
    await engine.clear("e1");
    expect(entityStored.e1).toBeUndefined();
    // Global config untouched.
    expect(await engine.getActiveConfig()).toEqual({
      provider: "Exa",
      key: "g",
    });
  });
});
