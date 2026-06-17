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

  it("forwards a configured api key verbatim", () => {
    createOpenAIClient({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-1" });
    expect(ctorMock.mock.calls[0][0]).toMatchObject({
      apiKey: "sk-1",
      baseURL: "https://api.openai.com/v1",
    });
  });

  it("falls back to a placeholder key when none is set (keyless compatible backends)", () => {
    createOpenAIClient({ baseUrl: "http://localhost:1234/v1" });
    expect(ctorMock.mock.calls[0][0].apiKey).toBe("no-key");
  });

  it("falls back to a placeholder key when the key is an empty string", () => {
    createOpenAIClient({ baseUrl: "http://localhost:1234/v1", apiKey: "" });
    expect(ctorMock.mock.calls[0][0].apiKey).toBe("no-key");
  });
});
