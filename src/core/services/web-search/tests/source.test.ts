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
      "https://only.example/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tk" }),
        body: JSON.stringify({ engine: "exa", query: "x", numResults: 5 }),
      })
    );
    expect(JSON.parse(out)).toEqual({ data: ["r"] });
  });

  it("merges custom headers for ONLYOFFICE web_search (custom wins over bearer)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: ["r"] }),
    });
    await callWebSearchTool(
      makeStorage({
        provider: "ONLYOFFICE",
        key: "tk",
        baseUrl: "https://only.example",
        headers: { "X-Tenant": "acme", Authorization: "Bearer custom" },
      }),
      "web_search",
      { query: "x" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://only.example/search",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Tenant": "acme",
          Authorization: "Bearer custom",
        }),
      })
    );
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
      "https://cloud.example/search",
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
      "https://x/contents",
      expect.objectContaining({
        body: JSON.stringify({ engine: "exa", urls: ["https://target"] }),
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

describe("callWebSearchTool source metadata", () => {
  const SOURCE = { id: "room-9", type: "Room", title: "Sales" };
  const METADATA = {
    source_id: "room-9",
    source_type: "Room",
    source_title: "Sales",
  };
  const onlyoffice = () =>
    makeStorage({
      provider: "ONLYOFFICE",
      key: "tk",
      baseUrl: "https://only.example",
    });
  const sentBody = () =>
    JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: ["r"] }),
    });
  });

  it("sends the source as `metadata` on an ONLYOFFICE web_search", async () => {
    await callWebSearchTool(
      onlyoffice(),
      "web_search",
      { query: "x" },
      undefined,
      undefined,
      SOURCE
    );
    expect(sentBody()).toEqual({
      engine: "exa",
      query: "x",
      numResults: 5,
      metadata: METADATA,
    });
  });

  it("sends the source as `metadata` on an ONLYOFFICE web_crawling", async () => {
    await callWebSearchTool(
      onlyoffice(),
      "web_crawling",
      { urls: ["https://target"] },
      undefined,
      undefined,
      SOURCE
    );
    expect(sentBody()).toEqual({
      engine: "exa",
      urls: ["https://target"],
      metadata: METADATA,
    });
  });

  it("includes only the source keys with a value", async () => {
    await callWebSearchTool(
      onlyoffice(),
      "web_search",
      { query: "x" },
      undefined,
      undefined,
      { id: "file-3" }
    );
    expect(sentBody().metadata).toEqual({ source_id: "file-3" });
  });

  it("sends no `metadata` key when no source is known", async () => {
    await callWebSearchTool(onlyoffice(), "web_search", { query: "x" });
    expect(sentBody()).not.toHaveProperty("metadata");
  });

  it("never sends the source to Exa directly", async () => {
    await callWebSearchTool(
      makeStorage({ provider: "Exa", key: "x" }),
      "web_search",
      { query: "x" },
      undefined,
      undefined,
      SOURCE
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.exa.ai/search");
    expect(sentBody()).not.toHaveProperty("metadata");
  });
});
