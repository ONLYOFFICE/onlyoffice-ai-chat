import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("openaicompatible/models/listModels", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns every model with the broad default capability mask", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    });
    const out = await listModels({
      baseUrl: "https://internal-llm",
      apiKey: "k",
    });
    expect(out).toHaveLength(3);
    for (const m of out) {
      expect(m.provider).toBe("openaicompatible");
      expect(m.capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools
      );
    }
  });
});
