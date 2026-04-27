import { beforeEach, describe, expect, it, vi } from "vitest";
import { openaicompatibleInfo } from "../info";
import { OpenAICompatibleProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("OpenAICompatibleProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(OpenAICompatibleProvider.getName()).toBe(openaicompatibleInfo.name);
    expect(OpenAICompatibleProvider.getBaseUrl()).toBe(
      openaicompatibleInfo.baseUrl
    );
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
    const out = await OpenAICompatibleProvider.getProviderModels({
      baseUrl: "https://internal",
      apiKey: "k",
    });
    expect(out[0].provider).toBe("openaicompatible");
  });
});
