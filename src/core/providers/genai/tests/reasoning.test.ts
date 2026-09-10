import { describe, expect, it } from "vitest";
import { getGenAIReasoningSupport } from "../reasoning";

describe("getGenAIReasoningSupport", () => {
  it("follows Google's per-model thinking_level table", () => {
    expect(getGenAIReasoningSupport("gemini-2.5-flash")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high"],
    });
    expect(getGenAIReasoningSupport("gemini-2.5-pro")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high"],
    });
    expect(getGenAIReasoningSupport("gemini-3-pro-preview").depths).toEqual([
      "low",
      "high",
    ]);
    expect(getGenAIReasoningSupport("gemini-3.1-pro-preview").depths).toEqual([
      "low",
      "medium",
      "high",
    ]);
    expect(getGenAIReasoningSupport("gemini-3.8-flash").canDisable).toBe(false);
  });

  it("knows the models without thinking", () => {
    expect(getGenAIReasoningSupport("gemini-2.0-flash").thinks).toBe(false);
    expect(getGenAIReasoningSupport("gemini-1.5-pro").thinks).toBe(false);
    expect(getGenAIReasoningSupport("imagen-4.0-generate-001").thinks).toBe(
      false
    );
  });
});
