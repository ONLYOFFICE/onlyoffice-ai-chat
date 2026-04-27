import { beforeEach, describe, expect, it, vi } from "vitest";
import { groqInfo } from "../info";
import { GroqProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("GroqProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(GroqProvider.getName()).toBe(groqInfo.name);
    expect(GroqProvider.getBaseUrl()).toBe(groqInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "llama3-8b" }],
    });
    const out = await GroqProvider.getProviderModels({
      baseUrl: groqInfo.baseUrl,
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("groq");
  });
});
