import { describe, expect, it } from "vitest";
import { getXAIReasoningSupport } from "../reasoning";

describe("getXAIReasoningSupport", () => {
  it("follows xAI's per-model reasoning_effort table", () => {
    expect(getXAIReasoningSupport("grok-4.6")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high", "max"],
    });
    expect(getXAIReasoningSupport("grok-4.20-multi-agent").depths).toHaveLength(
      4
    );
    expect(getXAIReasoningSupport("grok-4.5").depths).toEqual([
      "low",
      "medium",
      "high",
    ]);
    expect(getXAIReasoningSupport("grok-3-mini").depths).toEqual([
      "low",
      "high",
    ]);
  });

  it("gives the always-thinking models without a knob no depths", () => {
    expect(getXAIReasoningSupport("grok-4")).toEqual({
      thinks: true,
      canDisable: false,
      depths: [],
    });
    expect(getXAIReasoningSupport("grok-4.1-fast").depths).toEqual([]);
    expect(getXAIReasoningSupport("grok-code-fast-1").depths).toEqual([]);
  });

  it("knows the models without thinking", () => {
    expect(getXAIReasoningSupport("grok-3").thinks).toBe(false);
    expect(getXAIReasoningSupport("grok-2-vision-1212").thinks).toBe(false);
    expect(getXAIReasoningSupport("grok-2-image-1212").thinks).toBe(false);
  });
});
