import { describe, expect, it } from "vitest";
import {
  clampReasoningLevel,
  effectiveReasoningLevel,
  isReasoningLevel,
  REASONING_LEVELS,
  reasoningSupport,
  resolveReasoningLevel,
  type ReasoningDepth,
} from "../reasoning-level";

describe("resolveReasoningLevel", () => {
  it("prefers an explicit level over the legacy boolean", () => {
    expect(
      resolveReasoningLevel({ reasoningLevel: "high", withReasoning: false })
    ).toBe("high");
    expect(
      resolveReasoningLevel({ reasoningLevel: "off", withReasoning: true })
    ).toBe("off");
  });

  it("maps the legacy boolean onto medium / off", () => {
    expect(resolveReasoningLevel({ withReasoning: true })).toBe("medium");
    expect(resolveReasoningLevel({ withReasoning: false })).toBe("off");
    expect(resolveReasoningLevel({})).toBe("off");
  });
});

describe("isReasoningLevel", () => {
  it("accepts every level and rejects anything else", () => {
    for (const level of REASONING_LEVELS) {
      expect(isReasoningLevel(level)).toBe(true);
    }
    expect(isReasoningLevel("default")).toBe(false);
    expect(isReasoningLevel(true)).toBe(false);
    expect(isReasoningLevel(undefined)).toBe(false);
  });
});

describe("clampReasoningLevel", () => {
  const support = (depths: ReasoningDepth[]) =>
    reasoningSupport(depths, { canDisable: true });

  it("keeps off and listed depths as they are", () => {
    expect(clampReasoningLevel("off", support(["low", "high"]))).toBe("off");
    expect(clampReasoningLevel("high", support(["low", "high"]))).toBe("high");
  });

  it("snaps to the nearest listed depth, ties upward", () => {
    expect(clampReasoningLevel("medium", support(["low", "high"]))).toBe(
      "high"
    );
    expect(clampReasoningLevel("max", support(["low", "medium", "high"]))).toBe(
      "high"
    );
    expect(clampReasoningLevel("low", support(["medium", "high"]))).toBe(
      "medium"
    );
    expect(clampReasoningLevel("high", support(["medium"]))).toBe("medium");
  });

  it("leaves the level alone when the model has no depth knob", () => {
    expect(clampReasoningLevel("max", support([]))).toBe("max");
  });
});

describe("effectiveReasoningLevel", () => {
  it("turns off into the standard depth on a model that cannot be switched off", () => {
    const full = reasoningSupport(["low", "medium", "high", "max"], {
      canDisable: false,
    });
    expect(effectiveReasoningLevel("off", full)).toBe("medium");
    // Clamped like any other pick: no medium here, ties resolve upward.
    const twoDepths = reasoningSupport(["low", "high"], { canDisable: false });
    expect(effectiveReasoningLevel("off", twoDepths)).toBe("high");
    expect(effectiveReasoningLevel("medium", twoDepths)).toBe("high");
  });

  it("prefers the catalogue's default depth for off on a model that cannot stop", () => {
    const grok = reasoningSupport(["low", "medium", "high", "max"], {
      canDisable: false,
      defaultDepth: "high",
    });
    expect(effectiveReasoningLevel("off", grok)).toBe("high");
  });

  it("keeps off where it works or where there is no knob", () => {
    expect(
      effectiveReasoningLevel(
        "off",
        reasoningSupport(["low"], { canDisable: true })
      )
    ).toBe("off");
    expect(
      effectiveReasoningLevel(
        "off",
        reasoningSupport([], { canDisable: false })
      )
    ).toBe("off");
  });
});
