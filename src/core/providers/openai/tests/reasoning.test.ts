import { describe, expect, it } from "vitest";
import {
  resolveReasoningEffort,
  supportsNoneReasoning,
} from "../reasoning";

describe("supportsNoneReasoning", () => {
  it("is true for non-pro gpt-5.1 and newer (5.1, 5.2, 5.5)", () => {
    expect(supportsNoneReasoning("gpt-5.1")).toBe(true);
    expect(supportsNoneReasoning("gpt-5.2-2025-12-11")).toBe(true);
    expect(supportsNoneReasoning("gpt-5.5")).toBe(true);
  });

  it("is false for pro variants (no effort below medium)", () => {
    expect(supportsNoneReasoning("gpt-5.5-pro")).toBe(false);
    expect(supportsNoneReasoning("gpt-5.1-pro")).toBe(false);
    expect(supportsNoneReasoning("gpt-5-pro")).toBe(false);
  });

  it("is false for gpt-5(.0), o-series and non-reasoning models", () => {
    expect(supportsNoneReasoning("gpt-5")).toBe(false);
    expect(supportsNoneReasoning("o3")).toBe(false);
    expect(supportsNoneReasoning("gpt-4o")).toBe(false);
    expect(supportsNoneReasoning("grok-reasoning-1")).toBe(false);
  });
});

describe("resolveReasoningEffort", () => {
  it("returns medium when reasoning is on, regardless of model", () => {
    expect(resolveReasoningEffort("gpt-4o", true)).toBe("medium");
    expect(resolveReasoningEffort("gpt-5.5", true)).toBe("medium");
  });

  it("returns none when off for models that support it", () => {
    expect(resolveReasoningEffort("gpt-5.5", false)).toBe("none");
    expect(resolveReasoningEffort("gpt-5.1", false)).toBe("none");
  });

  it("returns medium for pro models even when off (no lower effort allowed)", () => {
    expect(resolveReasoningEffort("gpt-5.5-pro", true)).toBe("medium");
    expect(resolveReasoningEffort("gpt-5.5-pro", false)).toBeUndefined();
  });

  it("returns undefined when off for models without none support", () => {
    expect(resolveReasoningEffort("gpt-4o", false)).toBeUndefined();
    expect(resolveReasoningEffort("gpt-5", false)).toBeUndefined();
    expect(resolveReasoningEffort("gpt-5.5-pro", false)).toBeUndefined();
    expect(resolveReasoningEffort("o3", undefined)).toBeUndefined();
  });
});
