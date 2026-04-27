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

function makeStorage(seed: { config?: WebSearchConfig | null } = {}) {
  let stored: WebSearchConfig | null = seed.config ?? null;
  const storage = {
    webSearch: {
      read: vi.fn(async () => stored),
      upsert: vi.fn(async (c: WebSearchConfig) => {
        stored = c;
      }),
      delete: vi.fn(async () => {
        stored = null;
      }),
    },
  } as unknown as StorageAdapter;
  return { storage, get current() { return stored; } };
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
    expect(storage.webSearch.upsert).toHaveBeenCalledWith({
      provider: "Exa",
      key: "k",
    });
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
