import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { inferCapabilities, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("zhipu/models/inferCapabilities", () => {
  it("maps cogview / image ids to Image", () => {
    expect(inferCapabilities("cogview-3")).toBe(CapabilitiesUI.Image);
    expect(inferCapabilities("Image-Generation")).toBe(CapabilitiesUI.Image);
  });
  it("defaults to Chat + Tools", () => {
    expect(inferCapabilities("glm-4")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools
    );
  });
});

describe("zhipu/models/listModels", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("maps SDK models onto the zhipu shape", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "glm-4" }, { id: "cogview-3" }],
    });
    const out = await listModels({
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      apiKey: "sk",
    });
    expect(out[0].capabilities).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools
    );
    expect(out[1].capabilities).toBe(CapabilitiesUI.Image);
  });

  it("falls back to the hard-coded list on error", async () => {
    modelsListMock.mockRejectedValueOnce(new Error("x"));
    const out = await listModels({
      baseUrl: "https://x",
      apiKey: "sk",
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].provider).toBe("zhipu");
  });
});
