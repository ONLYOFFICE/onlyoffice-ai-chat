import { beforeEach, describe, expect, it, vi } from "vitest";
import { deepseekInfo } from "../info";
import { DeepSeekProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("DeepSeekProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(DeepSeekProvider.getName()).toBe(deepseekInfo.name);
    expect(DeepSeekProvider.getBaseUrl()).toBe(deepseekInfo.baseUrl);
  });

  it("constructs with valid credentials", () => {
    expect(
      new DeepSeekProvider({ baseUrl: deepseekInfo.baseUrl, apiKey: "sk" })
    ).toBeDefined();
  });

  it("delegates getProviderModels to listModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "deepseek-chat" }] });
    const out = await DeepSeekProvider.getProviderModels({
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("deepseek");
  });
  describe("reasoning request fields", () => {
    const fieldsOf = (model: string, withReasoning?: boolean) =>
      (
        new DeepSeekProvider({
          baseUrl: "https://x",
          apiKey: "sk",
        }) as unknown as {
          reasoningRequestFields: (
            model: string,
            withReasoning?: boolean
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, withReasoning);

    it("switches V4 thinking through thinking.type, off included", () => {
      // V4 thinks by default; omitting the field leaves reasoning on.
      expect(fieldsOf("deepseek-v4-flash", false)).toEqual({
        thinking: { type: "disabled" },
      });
      expect(fieldsOf("deepseek-v4-pro", true)).toEqual({
        thinking: { type: "enabled" },
      });
    });

    it("never sends reasoning_effort (DeepSeek has no medium)", () => {
      expect(fieldsOf("deepseek-v4-pro", true)).not.toHaveProperty(
        "reasoning_effort"
      );
    });

    it("leaves the always-thinking reasoner alias alone", () => {
      expect(fieldsOf("deepseek-reasoner", false)).toEqual({});
      expect(fieldsOf("deepseek-reasoner", true)).toEqual({});
    });
  });
});
