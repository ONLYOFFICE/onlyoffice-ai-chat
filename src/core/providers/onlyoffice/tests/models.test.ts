import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("onlyoffice/models/listModels", () => {
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
      expect(m.provider).toBe("onlyoffice");
      expect(m.capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools
      );
    }
  });

  it("reads OpenRouter's reasoning object off each entry", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [
        {
          id: "anthropic/claude-sonnet-5",
          reasoning: {
            mandatory: false,
            supported_efforts: ["max", "high", "medium", "low"],
            default_effort: "high",
          },
        },
        { id: "openai/gpt-4o", reasoning: null },
        { id: "legacy" },
      ],
    });
    const out = await listModels({ baseUrl: "https://internal", apiKey: "k" });
    expect(out[0].reasoning).toBe(true);
    expect(out[0].reasoningSupport).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
      defaultDepth: "high",
    });
    expect(out[1].reasoning).toBe(false);
    expect(out[1].reasoningSupport?.thinks).toBe(false);
    expect(out[2].reasoning).toBeUndefined();
    expect(out[2].reasoningSupport).toBeUndefined();
  });
});
