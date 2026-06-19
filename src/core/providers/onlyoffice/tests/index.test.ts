import { beforeEach, describe, expect, it, vi } from "vitest";
import { onlyOfficeInfo } from "../info";
import { OnlyOfficeProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("OnlyOfficeProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(OnlyOfficeProvider.getName()).toBe(onlyOfficeInfo.name);
    expect(OnlyOfficeProvider.getBaseUrl()).toBe(onlyOfficeInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
    const out = await OnlyOfficeProvider.getProviderModels({
      baseUrl: "https://internal",
      apiKey: "k",
    });
    expect(out[0].provider).toBe("onlyoffice");
  });
});
