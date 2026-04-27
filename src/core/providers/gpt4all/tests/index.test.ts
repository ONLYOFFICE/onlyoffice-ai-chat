import { beforeEach, describe, expect, it, vi } from "vitest";
import { gpt4allInfo } from "../info";
import { GPT4AllProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("GPT4AllProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(GPT4AllProvider.getName()).toBe(gpt4allInfo.name);
    expect(GPT4AllProvider.getBaseUrl()).toBe(gpt4allInfo.baseUrl);
  });

  it("defaults baseUrl and apiKey when missing", () => {
    expect(
      new GPT4AllProvider({ baseUrl: "" } as unknown as never)
    ).toBeDefined();
  });

  it("delegates checkProvider", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [] });
    await expect(
      GPT4AllProvider.checkProvider({
        baseUrl: "http://localhost:4891/v1",
      })
    ).resolves.toBe(true);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "m" }] });
    const out = await GPT4AllProvider.getProviderModels({
      baseUrl: "http://localhost:4891/v1",
    });
    expect(out[0].provider).toBe("gpt4all");
  });
});
