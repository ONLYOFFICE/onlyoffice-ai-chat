import { describe, expect, it } from "vitest";
import { getDeepSeekReasoningSupport } from "../reasoning";

describe("getDeepSeekReasoningSupport", () => {
  it("gives the switchable models all four depths", () => {
    expect(getDeepSeekReasoningSupport("deepseek-v4-pro")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    });
  });

  it("gives the always-thinking alias neither switch nor depth", () => {
    expect(getDeepSeekReasoningSupport("deepseek-reasoner")).toEqual({
      thinks: true,
      canDisable: false,
      depths: [],
    });
  });
});
