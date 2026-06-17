import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAIClient } from "../client";

const { ctorMock } = vi.hoisted(() => ({ ctorMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    constructor(opts: unknown) {
      ctorMock(opts);
    }
  },
}));

describe("createOpenAIClient", () => {
  beforeEach(() => ctorMock.mockReset());

  it("forwards a configured api key verbatim and keeps the auth header", () => {
    createOpenAIClient({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-1" });
    const opts = ctorMock.mock.calls[0][0];
    expect(opts).toMatchObject({
      apiKey: "sk-1",
      baseURL: "https://api.openai.com/v1",
    });
    expect(opts.defaultHeaders).toBeUndefined();
  });

  it("drops the Authorization header when no key is set (keyless backends)", () => {
    createOpenAIClient({ baseUrl: "http://localhost:1234/v1" });
    const opts = ctorMock.mock.calls[0][0];
    expect(opts.apiKey).toBe("no-key");
    expect(opts.defaultHeaders).toEqual({ Authorization: null });
  });

  it("drops the Authorization header when the key is an empty string", () => {
    createOpenAIClient({ baseUrl: "http://localhost:1234/v1", apiKey: "" });
    const opts = ctorMock.mock.calls[0][0];
    expect(opts.apiKey).toBe("no-key");
    expect(opts.defaultHeaders).toEqual({ Authorization: null });
  });

  it("forwards custom headers as defaultHeaders", () => {
    createOpenAIClient({
      baseUrl: "https://gw.example.com/v1",
      apiKey: "sk-1",
      headers: { "X-Tenant": "acme", "X-Trace": "1" },
    });
    expect(ctorMock.mock.calls[0][0].defaultHeaders).toEqual({
      "X-Tenant": "acme",
      "X-Trace": "1",
    });
  });

  it("does not strip Authorization when the caller supplies one (keyless)", () => {
    createOpenAIClient({
      baseUrl: "https://gw.example.com/v1",
      headers: { Authorization: "Bearer gw-token" },
    });
    const opts = ctorMock.mock.calls[0][0];
    expect(opts.defaultHeaders).toEqual({ Authorization: "Bearer gw-token" });
  });

  it("keeps custom headers and still strips the derived bearer when keyless", () => {
    createOpenAIClient({
      baseUrl: "https://gw.example.com/v1",
      headers: { "X-Tenant": "acme" },
    });
    expect(ctorMock.mock.calls[0][0].defaultHeaders).toEqual({
      "X-Tenant": "acme",
      Authorization: null,
    });
  });
});
