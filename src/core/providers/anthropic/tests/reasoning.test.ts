import { describe, expect, it } from "vitest";
import { getAnthropicReasoningSupport } from "../reasoning";
import { resolveThinkingParam } from "../thinking";

describe("getAnthropicReasoningSupport", () => {
  it("gives every thinking Claude all four depths", () => {
    expect(getAnthropicReasoningSupport("claude-sonnet-4-5-20250929")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    });
    expect(getAnthropicReasoningSupport("claude-opus-5").canDisable).toBe(true);
    expect(
      getAnthropicReasoningSupport("claude-3-7-sonnet-latest").thinks
    ).toBe(true);
  });

  it("marks Fable / Mythos as impossible to switch off", () => {
    expect(getAnthropicReasoningSupport("claude-fable-5-1").canDisable).toBe(
      false
    );
    expect(getAnthropicReasoningSupport("claude-mythos-5-1").canDisable).toBe(
      false
    );
  });

  it("knows the pre-thinking generations", () => {
    expect(
      getAnthropicReasoningSupport("claude-3-5-sonnet-20241022").thinks
    ).toBe(false);
    expect(getAnthropicReasoningSupport("claude-3-opus-20240229").thinks).toBe(
      false
    );
    expect(getAnthropicReasoningSupport("claude-2.1").thinks).toBe(false);
  });
});

describe("resolveThinkingParam with an explicit support", () => {
  it("keeps thinking on for a stored off when the record says the model cannot stop", () => {
    expect(resolveThinkingParam("claude-sonnet-4-6", "off")).toEqual({
      thinking: { type: "disabled" },
    });
    expect(
      resolveThinkingParam("claude-sonnet-4-6", "off", {
        thinks: true,
        canDisable: false,
        depths: ["low", "medium", "high", "max"],
      })
    ).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
  });
});
