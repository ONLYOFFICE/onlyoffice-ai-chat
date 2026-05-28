import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { inferCapabilities, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("xai/models/inferCapabilities", () => {
  it("flags vision models as Chat + Vision", () => {
    expect(inferCapabilities("grok-vision-beta")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
  });
  it("flags image models as Image", () => {
    expect(inferCapabilities("grok-image")).toBe(CapabilitiesUI.Image);
  });
  it("defaults to Chat only", () => {
    expect(inferCapabilities("grok-beta")).toBe(CapabilitiesUI.Chat);
  });
});

describe("xai/models/listModels", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("reverses model order and flags reasoning ids", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "grok-reasoning-beta" }, { id: "grok-beta" }],
    });
    const out = await listModels({ baseUrl: "https://x", apiKey: "sk" });
    expect(out.map((m) => m.id)).toEqual(["grok-beta", "grok-reasoning-beta"]);
    expect(out[1].reasoning).toBe(true);
  });
});
