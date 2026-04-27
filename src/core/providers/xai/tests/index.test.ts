import { beforeEach, describe, expect, it, vi } from "vitest";
import { xaiInfo } from "../info";
import { XAIProvider } from "../index";

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
});
