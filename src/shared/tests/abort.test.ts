import { describe, expect, it } from "vitest";
import { isAbortError } from "../abort";

describe("isAbortError", () => {
  it("returns true when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(isAbortError(new Error("anything"), controller.signal)).toBe(true);
  });

  it("returns true for an AbortError-named error even without a signal", () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    expect(isAbortError(error)).toBe(true);
  });

  it("returns true for an AbortError-named error with an unaborted signal", () => {
    const controller = new AbortController();
    const error = new Error("aborted");
    error.name = "AbortError";
    expect(isAbortError(error, controller.signal)).toBe(true);
  });

  it("returns false for a generic error with no signal", () => {
    expect(isAbortError(new Error("boom"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isAbortError("aborted")).toBe(false);
    expect(isAbortError(42)).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError({ name: "AbortError" })).toBe(false);
  });

  it("returns false for a generic error with an unaborted signal", () => {
    const controller = new AbortController();
    expect(isAbortError(new Error("boom"), controller.signal)).toBe(false);
  });
});
