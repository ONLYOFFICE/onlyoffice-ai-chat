import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WEB_SEARCH_TYPE,
  callWebSearchTool,
  getWebSearchTools,
} from "../source";
import type { StorageAdapter } from "../../../storage";

vi.mock("../../../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function makeStorage(config: unknown) {
  return {
    webSearch: { read: vi.fn().mockResolvedValue(config) },
  } as unknown as StorageAdapter;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => vi.restoreAllMocks());

describe("WEB_SEARCH_TYPE", () => {
  it("is the stable string", () => {
    expect(WEB_SEARCH_TYPE).toBe("web-search");
  });
});

describe("getWebSearchTools", () => {
  it("returns empty when no config", async () => {
    const storage = makeStorage(null);
    expect(await getWebSearchTools(storage)).toEqual([]);
  });

  it("returns the two tools when configured", async () => {
    const storage = makeStorage({ provider: "Exa", key: "x" });
    const tools = await getWebSearchTools(storage);
    expect(tools.map((t) => t.name)).toEqual(["web_search", "web_crawling"]);
  });
});

describe("callWebSearchTool", () => {
  it("returns config error when not configured", async () => {
    const out = await callWebSearchTool(makeStorage(null), "web_search", {});
    expect(JSON.parse(out)).toEqual({ error: "Web search is not configured." });
  });

  it("returns unknown tool error for unknown name", async () => {
    const out = await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "weird",
      {}
    );
    expect(JSON.parse(out)).toEqual({ error: "Unknown tool: weird" });
  });

  it("dispatches Exa web_search", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: ["r1"] }),
    });
    const out = await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "web_search",
      { query: "hello" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.exa.ai/search",
      expect.objectContaining({ method: "POST" })
    );
    expect(JSON.parse(out)).toEqual({ data: ["r1"] });
  });

  it("returns network error when Exa request fails (non-ok)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const out = await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "web_search",
      { query: "x" }
    );
    expect(JSON.parse(out)).toEqual({
      error: 500,
      message: "Network error: 500",
    });
  });

  it("returns parsed.error when Exa response carries error field", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ error: "bad query" }),
    });
    const out = await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "web_search",
      { query: "x" }
    );
    expect(JSON.parse(out)).toEqual({ data: { error: "bad query" } });
  });

  it("captures fetch errors with message", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const out = await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "web_search",
      { query: "x" }
    );
    expect(JSON.parse(out)).toEqual({ error: "offline" });
  });

  it("captures non-Error rejection via String() fallback", async () => {
    fetchMock.mockRejectedValue("plain-error");
    const out = await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "web_search",
      { query: "x" }
    );
    expect(JSON.parse(out)).toEqual({ error: "plain-error" });
  });

  it("dispatches ONLYOFFICE web_search with bearer auth", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: ["r"] }),
    });
    const out = await callWebSearchTool(
      makeStorage({
        provider: "ONLYOFFICE",
        key: "tk",
        baseUrl: "https://only.example",
      }),
      "web_search",
      { query: "x" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://only.example/api/2.0/ai/web-search/v1/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tk" }),
      })
    );
    expect(JSON.parse(out)).toEqual({ data: ["r"] });
  });

  it("uses provider as baseUrl when isCloudProvider has no baseUrl", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });
    await callWebSearchTool(
      makeStorage({
        provider: "https://cloud.example",
        isCloudProvider: true,
      }),
      "web_search",
      { query: "x" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.example/api/2.0/ai/web-search/v1/search",
      expect.any(Object)
    );
  });

  it("dispatches ONLYOFFICE web_crawling", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: ["page"] }),
    });
    await callWebSearchTool(
      makeStorage({ provider: "ONLYOFFICE", baseUrl: "https://x" }),
      "web_crawling",
      { urls: ["https://target"] }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://x/api/2.0/ai/web-search/v1/contents",
      expect.objectContaining({
        body: JSON.stringify({ url: "https://target" }),
      })
    );
  });

  it("captures errors from ONLYOFFICE crawling", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const out = await callWebSearchTool(
      makeStorage({
        provider: "ONLYOFFICE",
        baseUrl: "https://x",
      }),
      "web_crawling",
      { urls: ["u"] }
    );
    expect(JSON.parse(out)).toEqual({ error: "offline" });
  });

  it("dispatches Exa web_crawling", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: ["page"] }),
    });
    await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "k" }),
      "web_crawling",
      { urls: ["https://target"] }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.exa.ai/contents",
      expect.objectContaining({
        body: JSON.stringify({ urls: ["https://target"], text: true }),
      })
    );
  });

  it("returns args JSON when provider is unsupported (web_search)", async () => {
    const out = await callWebSearchTool(
      makeStorage({ provider: "WeirdProvider" }),
      "web_search",
      { query: "x" }
    );
    expect(JSON.parse(out)).toEqual({ query: "x" });
  });

  it("returns args JSON when provider is unsupported (web_crawling)", async () => {
    const out = await callWebSearchTool(
      makeStorage({ provider: "WeirdProvider" }),
      "web_crawling",
      { urls: ["u"] }
    );
    expect(JSON.parse(out)).toEqual({ urls: ["u"] });
  });
});
