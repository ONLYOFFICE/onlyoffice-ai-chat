import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testWebSearchConnection, validateConfigShape } from "../validation";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateConfigShape", () => {
  it("requires provider", () => {
    expect(validateConfigShape({ provider: "" })?.message).toBe(
      "Provider is required"
    );
    expect(validateConfigShape({ provider: "   " })?.message).toBe(
      "Provider is required"
    );
  });

  it("requires baseUrl when isCloudProvider", () => {
    expect(
      validateConfigShape({ provider: "Custom", isCloudProvider: true })
        ?.message
    ).toBe("Base URL is required for cloud provider");
  });

  it("requires baseUrl for ONLYOFFICE", () => {
    expect(validateConfigShape({ provider: "ONLYOFFICE" })?.message).toBe(
      "Base URL is required for cloud provider"
    );
  });

  it("rejects unparseable baseUrl for cloud providers", () => {
    expect(
      validateConfigShape({
        provider: "ONLYOFFICE",
        baseUrl: "not a url",
      })?.message
    ).toBe("Invalid base URL");
  });

  it("returns null when valid (Exa)", () => {
    expect(validateConfigShape({ provider: "Exa", key: "k" })).toBeNull();
  });

  it("returns null when valid (cloud with proper URL)", () => {
    expect(
      validateConfigShape({
        provider: "ONLYOFFICE",
        baseUrl: "https://x.example",
      })
    ).toBeNull();
  });
});

describe("testWebSearchConnection - Exa", () => {
  it("returns true on 200", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await testWebSearchConnection({ provider: "Exa", key: "k" })).toBe(
      true
    );
  });

  it("maps 401 to invalidKey", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const r = await testWebSearchConnection({ provider: "Exa", key: "k" });
    expect(r).not.toBe(true);
    if (r === true) throw new Error();
    expect(r.field).toBe("key");
  });

  it("maps 404 to invalidUrl", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    const r = await testWebSearchConnection({ provider: "Exa", key: "k" });
    if (r === true) throw new Error();
    expect(r.field).toBe("url");
  });

  it("maps no-key + non-401/404 to emptyKey", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    const r = await testWebSearchConnection({ provider: "Exa" });
    if (r === true) throw new Error();
    expect(r.message).toBe("Empty key");
  });

  it("maps any-status with key to invalidKey with status code", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    const r = await testWebSearchConnection({ provider: "Exa", key: "k" });
    if (r === true) throw new Error();
    expect(r.field).toBe("key");
    expect(r.message).toMatch(/status 500/);
  });

  it("returns connectionFailed on network throw", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fail"));
    const r = await testWebSearchConnection({ provider: "Exa", key: "k" });
    if (r === true) throw new Error();
    expect(r.field).toBe("url");
  });
});

describe("testWebSearchConnection - cloud / ONLYOFFICE", () => {
  it("uses bearer token when key present", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await testWebSearchConnection({
      provider: "ONLYOFFICE",
      baseUrl: "https://o.example",
      key: "tok",
    });
    expect(r).toBe(true);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toContain("/api/2.0/ai/web-search/v1/search");
    expect(callArgs[1].headers.Authorization).toBe("Bearer tok");
  });

  it("works without key (cloud isCloudProvider)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await testWebSearchConnection({
      provider: "Other",
      baseUrl: "https://x.example",
      isCloudProvider: true,
    });
    expect(r).toBe(true);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBeUndefined();
  });
});

describe("testWebSearchConnection unknown provider", () => {
  it("returns 'Unknown web-search provider' for non-Exa, non-cloud, non-ONLYOFFICE", async () => {
    const r = await testWebSearchConnection({ provider: "Custom" });
    if (r === true) throw new Error();
    expect(r.message).toMatch(/Unknown web-search provider/);
  });
});
