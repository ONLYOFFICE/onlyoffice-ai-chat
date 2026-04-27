import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("deepseek/models/listModels", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("reverses the order and marks reasoner ids", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }],
    });
    const out = await listModels({
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk",
    });
    expect(out.map((m) => m.id)).toEqual([
      "deepseek-reasoner",
      "deepseek-chat",
    ]);
    expect(out[0].reasoning).toBe(true);
    expect(out[0].capabilities).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools
    );
    expect(out[1].reasoning).toBe(false);
  });
});
