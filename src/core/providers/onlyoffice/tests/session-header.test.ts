import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnlyOfficeProvider } from "../index";

const { ctorMock } = vi.hoisted(() => ({ ctorMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    constructor(opts: unknown) {
      ctorMock(opts);
    }
  },
}));

/** Headers the SDK client was constructed with. */
const clientHeaders = (): Record<string, string | null> | undefined =>
  ctorMock.mock.calls[0]?.[0]?.defaultHeaders;

describe("OnlyOfficeProvider session header", () => {
  beforeEach(() => ctorMock.mockReset());

  it("sends the session id as x-session-id", () => {
    new OnlyOfficeProvider({
      baseUrl: "https://internal",
      apiKey: "k",
      sessionId: "thread-42",
    });
    expect(clientHeaders()).toMatchObject({ "x-session-id": "thread-42" });
  });

  it("keeps profile headers alongside the session header", () => {
    new OnlyOfficeProvider({
      baseUrl: "https://internal",
      apiKey: "k",
      sessionId: "thread-42",
      headers: { "X-Tenant": "acme" },
    });
    expect(clientHeaders()).toMatchObject({
      "X-Tenant": "acme",
      "x-session-id": "thread-42",
    });
  });

  it("lets an explicit header win over the session id", () => {
    new OnlyOfficeProvider({
      baseUrl: "https://internal",
      apiKey: "k",
      sessionId: "thread-42",
      headers: { "X-Session-Id": "host-owned" },
    });
    const headers = clientHeaders();
    expect(headers?.["X-Session-Id"]).toBe("host-owned");
    expect(headers).not.toHaveProperty("x-session-id");
  });

  it("adds no header when no session id is supplied", () => {
    new OnlyOfficeProvider({ baseUrl: "https://internal", apiKey: "k" });
    expect(clientHeaders()).toBeUndefined();
  });
});
