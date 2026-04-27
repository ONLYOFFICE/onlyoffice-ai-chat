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
});
