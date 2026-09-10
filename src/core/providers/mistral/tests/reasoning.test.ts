import { describe, expect, it } from "vitest";
import { getMistralReasoningSupport } from "../reasoning";

describe("getMistralReasoningSupport", () => {
  it("has no depth: Magistral thinks always, swappable models toggle", () => {
    expect(getMistralReasoningSupport("magistral-medium-latest")).toEqual({
      thinks: true,
      canDisable: false,
      depths: [],
    });
    expect(getMistralReasoningSupport("mistral-small-latest")).toEqual({
      thinks: true,
      canDisable: true,
      depths: [],
    });
  });

  it("knows the models without a Magistral counterpart", () => {
    expect(getMistralReasoningSupport("codestral-latest").thinks).toBe(false);
    expect(getMistralReasoningSupport("pixtral-12b").thinks).toBe(false);
  });
});
