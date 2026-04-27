import { beforeEach, describe, expect, it, vi } from "vitest";
import { openrouterInfo } from "../info";
import { OpenRouterProvider } from "../index";

describe("OpenRouterProvider", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns canonical name/baseUrl", () => {
    expect(OpenRouterProvider.getName()).toBe(openrouterInfo.name);
    expect(OpenRouterProvider.getBaseUrl()).toBe(openrouterInfo.baseUrl);
  });

  it("delegates checkProvider", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as unknown as Response);
    await expect(
      OpenRouterProvider.checkProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      })
    ).resolves.toBe(true);
  });

  it("delegates getProviderModels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ data: [{ id: "x/y" }] }),
    } as unknown as Response);
    const out = await OpenRouterProvider.getProviderModels({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("openrouter");
  });
});
