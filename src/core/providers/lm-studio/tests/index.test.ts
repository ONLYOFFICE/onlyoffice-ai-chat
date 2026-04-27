import { beforeEach, describe, expect, it, vi } from "vitest";
import { lmStudioInfo } from "../info";
import { LMStudioProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("LMStudioProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(LMStudioProvider.getName()).toBe(lmStudioInfo.name);
    expect(LMStudioProvider.getBaseUrl()).toBe(lmStudioInfo.baseUrl);
  });

  it("accepts credentials without an api key", () => {
    expect(
      new LMStudioProvider({ baseUrl: "http://localhost:1234/v1" })
    ).toBeDefined();
  });

  it("delegates checkProvider", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
    await expect(
      LMStudioProvider.checkProvider({
        baseUrl: "http://localhost:1234/v1",
      })
    ).resolves.toBe(true);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "local" }] });
    const out = await LMStudioProvider.getProviderModels({
      baseUrl: "http://localhost:1234/v1",
    });
    expect(out[0].provider).toBe("lm-studio");
  });
});
