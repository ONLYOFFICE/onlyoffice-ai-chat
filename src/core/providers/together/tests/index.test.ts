import { beforeEach, describe, expect, it, vi } from "vitest";
import { togetherInfo } from "../info";
import { TogetherProvider } from "../index";

describe("TogetherProvider", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns canonical name/baseUrl", () => {
    expect(TogetherProvider.getName()).toBe(togetherInfo.name);
    expect(TogetherProvider.getBaseUrl()).toBe(togetherInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve([{ id: "m", type: "chat" }]),
    } as unknown as Response);
    const out = await TogetherProvider.getProviderModels({
      baseUrl: "https://api.together.xyz/v1",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("together");
  });
});
