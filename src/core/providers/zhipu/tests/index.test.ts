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
});
