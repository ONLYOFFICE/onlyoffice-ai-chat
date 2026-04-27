import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { inferCapabilities, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("groq/models/inferCapabilities", () => {
  it("returns Chat + Tools by default", () => {
    expect(inferCapabilities("llama3-8b-8192")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools
    );
  });
  it("adds Vision when id contains vision", () => {
    expect(inferCapabilities("llava-v1.5-vision")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools | CapabilitiesUI.Vision
    );
  });
});

describe("groq/models/listModels", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("filters out Whisper entries", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [
        { id: "llama3-8b" },
        { id: "whisper-large-v3" },
        { id: "llava-vision" },
      ],
    });
    const out = await listModels({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "sk",
    });
    expect(out.map((m) => m.id)).toEqual(["llama3-8b", "llava-vision"]);
  });
});
