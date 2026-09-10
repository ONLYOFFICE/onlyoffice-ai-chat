import { beforeEach, describe, expect, it, vi } from "vitest";
import { zhipuInfo } from "../info";
import { ZhipuProvider } from "../index";
import type { ReasoningLevel } from "../../../../shared/reasoning-level";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("ZhipuProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(ZhipuProvider.getName()).toBe(zhipuInfo.name);
    expect(ZhipuProvider.getBaseUrl()).toBe(zhipuInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "glm-4" }] });
    const out = await ZhipuProvider.getProviderModels({
      baseUrl: zhipuInfo.baseUrl,
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("zhipu");
  });
  describe("reasoning request fields", () => {
    const fieldsOf = (model: string, level: ReasoningLevel) =>
      (
        new ZhipuProvider({
          baseUrl: "https://x",
          apiKey: "sk",
        }) as unknown as {
          reasoningRequestFields: (
            model: string,
            level: ReasoningLevel
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, level);

    it("switches GLM-4.5+ thinking through thinking.type, off included", () => {
      expect(fieldsOf("glm-4.5", "off")).toEqual({
        thinking: { type: "disabled" },
      });
      expect(fieldsOf("glm-4.6", "medium")).toEqual({
        thinking: { type: "enabled" },
      });
      expect(fieldsOf("glm-5", "off")).toEqual({
        thinking: { type: "disabled" },
      });
    });

    it("has no depth: every level above off is plain enabled", () => {
      expect(fieldsOf("glm-5", "low")).toEqual({
        thinking: { type: "enabled" },
      });
      expect(fieldsOf("glm-5", "max")).toEqual({
        thinking: { type: "enabled" },
      });
    });

    it("sends nothing to the non-thinking GLM-4 models", () => {
      expect(fieldsOf("glm-4-flash", "off")).toEqual({});
      expect(fieldsOf("glm-4-plus", "medium")).toEqual({});
    });
  });
});
