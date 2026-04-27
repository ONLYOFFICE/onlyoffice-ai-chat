import { beforeEach, describe, expect, it, vi } from "vitest";
import { ollamaInfo } from "../info";
import { OllamaProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("OllamaProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(OllamaProvider.getName()).toBe(ollamaInfo.name);
    expect(OllamaProvider.getBaseUrl()).toBe(ollamaInfo.baseUrl);
  });

  it("injects a dummy api key when none is provided", () => {
    expect(
      new OllamaProvider({ baseUrl: "http://localhost:11434/v1" })
    ).toBeDefined();
  });

  it("delegates checkProvider to checkCredentials", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [] });
    await expect(
      OllamaProvider.checkProvider({
        baseUrl: "http://localhost:11434/v1",
      })
    ).resolves.toBe(true);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "llama3" }] });
    const out = await OllamaProvider.getProviderModels({
      baseUrl: "http://localhost:11434/v1",
    });
    expect(out[0].provider).toBe("ollama");
  });
});
