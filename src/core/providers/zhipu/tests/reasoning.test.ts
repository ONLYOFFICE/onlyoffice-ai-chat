import { describe, expect, it } from "vitest";
import { getZhipuReasoningSupport } from "../reasoning";

describe("getZhipuReasoningSupport", () => {
  it("is an on/off switch from GLM-4.5 on and nothing before", () => {
    expect(getZhipuReasoningSupport("glm-4.5")).toEqual({
      thinks: true,
      canDisable: true,
      depths: [],
    });
    expect(getZhipuReasoningSupport("glm-5").canDisable).toBe(true);
    expect(getZhipuReasoningSupport("glm-4-plus").thinks).toBe(false);
  });
});
