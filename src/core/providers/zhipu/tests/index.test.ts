import { beforeEach, describe, expect, it, vi } from "vitest";
import { zhipuInfo } from "../info";
import { ZhipuProvider } from "../index";

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
    const fieldsOf = (model: string, withReasoning?: boolean) =>
      (
        new ZhipuProvider({
          baseUrl: "https://x",
          apiKey: "sk",
        }) as unknown as {
          reasoningRequestFields: (
            model: string,
            withReasoning?: boolean
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, withReasoning);

    it("switches GLM-4.5+ thinking through thinking.type, off included", () => {
      expect(fieldsOf("glm-4.5", false)).toEqual({
        thinking: { type: "disabled" },
      });
      expect(fieldsOf("glm-4.6", true)).toEqual({
        thinking: { type: "enabled" },
      });
      expect(fieldsOf("glm-5", false)).toEqual({
        thinking: { type: "disabled" },
      });
    });

    it("sends nothing to the non-thinking GLM-4 models", () => {
      expect(fieldsOf("glm-4-flash", false)).toEqual({});
      expect(fieldsOf("glm-4-plus", true)).toEqual({});
    });
  });
});
