import { describe, expect, it } from "vitest";
import { toChatError, type ChatErrorPayload } from "../error";

describe("toChatError", () => {
  it("survives JSON.stringify round-trip", () => {
    const payload = toChatError(new Error("boom"));
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(roundTripped).toEqual(payload);
    expect(roundTripped.message).toBe("boom");
  });

  it("strips non-enumerable Error fields cleanly (no `stack`)", () => {
    const payload = toChatError(new Error("boom"));
    expect(payload).not.toHaveProperty("stack");
    expect(JSON.stringify(payload)).not.toContain("stack");
  });

  it("classifies OpenAI 401 as auth", () => {
    const err = Object.assign(new Error("Incorrect API key"), { status: 401 });
    expect(toChatError(err).code).toBe("auth");
  });

  it("classifies 404 with 'model' in message as model_not_found", () => {
    const err = Object.assign(new Error("The model gpt-99 does not exist"), {
      status: 404,
    });
    expect(toChatError(err).code).toBe("model_not_found");
  });

  it("classifies 429 as rate_limit", () => {
    const err = Object.assign(new Error("Too many requests"), { status: 429 });
    expect(toChatError(err).code).toBe("rate_limit");
  });

  it("classifies AbortError as aborted", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(toChatError(err).code).toBe("aborted");
  });

  it("classifies fetch TypeError as network", () => {
    const err = new TypeError("fetch failed");
    expect(toChatError(err).code).toBe("network");
  });

  it("classifies Anthropic-style rate_limit_error via error.type", () => {
    const err = Object.assign(new Error("slow down"), {
      error: { type: "rate_limit_error" },
    });
    expect(toChatError(err).code).toBe("rate_limit");
  });

  it("recurses cause", () => {
    const cause = Object.assign(new Error("upstream"), { status: 401 });
    const err = new Error("wrapper", { cause });
    const payload = toChatError(err);
    expect(payload.cause).toBeDefined();
    expect(payload.cause?.code).toBe("auth");
    expect(payload.cause?.message).toBe("upstream");
  });

  it("passes plain strings through", () => {
    expect(toChatError("nope")).toEqual({
      code: "unknown",
      message: "nope",
    });
  });

  it("passes null/undefined as unknown", () => {
    expect(toChatError(null).code).toBe("unknown");
    expect(toChatError(undefined).code).toBe("unknown");
  });

  it("is idempotent on existing payloads", () => {
    const payload: ChatErrorPayload = { code: "auth", message: "no key" };
    expect(toChatError(payload)).toEqual(payload);
  });

  it("extracts message/code from plain objects", () => {
    const result = toChatError({ code: "weird", message: "huh" });
    expect(result).toEqual({ code: "weird", message: "huh" });
  });
});
