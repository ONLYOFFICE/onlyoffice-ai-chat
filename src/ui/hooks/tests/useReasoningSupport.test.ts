import { describe, expect, it } from "vitest";
import { FULL_REASONING_SUPPORT } from "../../../shared/reasoning-level";
import { resolveProfileReasoningSupport } from "../useReasoningSupport";

describe("resolveProfileReasoningSupport", () => {
  it("answers everything until a profile is picked", () => {
    expect(resolveProfileReasoningSupport(null)).toEqual(
      FULL_REASONING_SUPPORT
    );
  });

  it("asks the profile's provider about its model", () => {
    expect(
      resolveProfileReasoningSupport({
        providerType: "genai",
        modelId: "gemini-3-pro-preview",
      }).depths
    ).toEqual(["low", "high"]);
    expect(
      resolveProfileReasoningSupport({
        providerType: "openai",
        modelId: "gpt-4o",
      }).thinks
    ).toBe(false);
  });

  it("answers an external profile for the provider it is based on", () => {
    expect(
      resolveProfileReasoningSupport({
        providerType: "external",
        basedOn: "anthropic",
        modelId: "claude-fable-5-1",
      }).canDisable
    ).toBe(false);
  });

  it("prefers the record the catalogue reported at save time", () => {
    expect(
      resolveProfileReasoningSupport({
        providerType: "openrouter",
        modelId: "anthropic/claude-sonnet-5",
        reasoningSupport: {
          thinks: true,
          canDisable: false,
          depths: ["low", "high"],
          defaultDepth: "high",
        },
      }).depths
    ).toEqual(["low", "high"]);
  });
});
