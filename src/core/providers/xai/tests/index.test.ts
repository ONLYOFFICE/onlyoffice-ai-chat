import { beforeEach, describe, expect, it, vi } from "vitest";
import { xaiInfo } from "../info";
import { XAIProvider } from "../index";
import type { ReasoningLevel } from "../../../../shared/reasoning-level";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("XAIProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(XAIProvider.getName()).toBe(xaiInfo.name);
    expect(XAIProvider.getBaseUrl()).toBe(xaiInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "grok-beta" }] });
    const out = await XAIProvider.getProviderModels({
      baseUrl: "https://api.x.ai/v1",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("xai");
  });

  describe("reasoning request fields", () => {
    const fieldsOf = (model: string, level: ReasoningLevel) =>
      (
        new XAIProvider({ baseUrl: "https://x", apiKey: "sk" }) as unknown as {
          reasoningRequestFields: (
            model: string,
            level: ReasoningLevel
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, level);

    it("passes the full scale to grok-4.5+, with xhigh from 4.6 on", () => {
      expect(fieldsOf("grok-4.5", "low")).toEqual({ reasoning_effort: "low" });
      expect(fieldsOf("grok-4.5", "medium")).toEqual({
        reasoning_effort: "medium",
      });
      expect(fieldsOf("grok-4.5", "max")).toEqual({ reasoning_effort: "high" });
      expect(fieldsOf("grok-4.6", "max")).toEqual({
        reasoning_effort: "xhigh",
      });
      expect(fieldsOf("grok-4.20-multi-agent", "max")).toEqual({
        reasoning_effort: "xhigh",
      });
    });

    it("knows only low and high on grok-3-mini", () => {
      expect(fieldsOf("grok-3-mini", "low")).toEqual({
        reasoning_effort: "low",
      });
      expect(fieldsOf("grok-3-mini", "medium")).toEqual({
        reasoning_effort: "high",
      });
    });

    it("sends nothing to models that reject the parameter", () => {
      expect(fieldsOf("grok-4", "medium")).toEqual({});
      expect(fieldsOf("grok-4.1-fast", "high")).toEqual({});
      expect(fieldsOf("grok-4-1-fast", "high")).toEqual({});
      expect(fieldsOf("grok-code-fast-1", "high")).toEqual({});
    });

    it("has no off switch: off is the standard depth, nothing where there is no knob", () => {
      expect(fieldsOf("grok-4.6", "off")).toEqual({
        reasoning_effort: "medium",
      });
      // No medium on grok-3-mini; ties resolve upward.
      expect(fieldsOf("grok-3-mini", "off")).toEqual({
        reasoning_effort: "high",
      });
      expect(fieldsOf("grok-4", "off")).toEqual({});
    });
  });
});
