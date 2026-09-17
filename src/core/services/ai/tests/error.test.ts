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

  describe("400 with the word 'model' in the message", () => {
    const at400 = (message: string, code?: string) =>
      toChatError(
        Object.assign(new Error(message), {
          status: 400,
          ...(code ? { code } : {}),
        })
      ).code;

    it("keeps a rejected parameter as bad_request even when the text names the model (Bug 83703)", () => {
      expect(
        at400(
          '"thinking.type.enabled" is not supported for this model. Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.'
        )
      ).toBe("bad_request");
      expect(at400("This model does not support tools")).toBe("bad_request");
      expect(
        at400(
          "Unsupported parameter: 'reasoning_effort' is not supported with this model."
        )
      ).toBe("bad_request");
    });

    it("still reports a missing model", () => {
      expect(
        at400(
          "The model `gpt-99` does not exist or you do not have access to it."
        )
      ).toBe("model_not_found");
      expect(at400("Unknown model: llama-x")).toBe("model_not_found");
      expect(
        at400("models/gemini-2.5-flash is no longer available to new users.")
      ).toBe("model_not_found");
      expect(at400("model not found")).toBe("model_not_found");
      expect(at400("The model is deprecated")).toBe("model_not_found");
    });

    it("trusts an explicit model_not_found code regardless of text", () => {
      expect(at400("Nope", "model_not_found")).toBe("model_not_found");
    });
  });

  it("classifies 402 as insufficient_funds", () => {
    const err = Object.assign(
      new Error("402 — insufficient funds to complete this request"),
      { status: 402 }
    );
    expect(toChatError(err).code).toBe("insufficient_funds");
  });

  it("classifies 402 as insufficient_funds regardless of message text", () => {
    const err = Object.assign(new Error("Payment Required"), { status: 402 });
    expect(toChatError(err).code).toBe("insufficient_funds");
  });

  it("falls back to the message when the transport drops the 402 status", () => {
    const err = new Error("402 — insufficient funds to complete this request");
    expect(toChatError(err).code).toBe("insufficient_funds");
    // Case-insensitive, and does not need the numeric prefix.
    expect(toChatError(new Error("Insufficient Funds")).code).toBe(
      "insufficient_funds"
    );
  });

  it("keeps the raw provider message alongside the insufficient_funds code", () => {
    const payload = toChatError(
      Object.assign(new Error("402 — insufficient funds"), { status: 402 })
    );
    expect(payload).toEqual({
      code: "insufficient_funds",
      message: "402 — insufficient funds",
    });
  });

  it("does not let the funds fallback shadow a more specific status", () => {
    // A 429 whose body happens to mention funds stays a rate limit.
    const err = Object.assign(new Error("insufficient funds, slow down"), {
      status: 429,
    });
    expect(toChatError(err).code).toBe("rate_limit");
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
