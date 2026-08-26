import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { anthropicInfo } from "../info";
import { inferCapabilities, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    models = { list: modelsListMock };
  },
}));

describe("anthropic/models/inferCapabilities", () => {
  it("marks claude-2 as Chat only", () => {
    expect(inferCapabilities("claude-2.1")).toBe(CapabilitiesUI.Chat);
  });

  it("marks claude-3-5-haiku as Chat only", () => {
    expect(inferCapabilities("claude-3-5-haiku-20241022")).toBe(
      CapabilitiesUI.Chat
    );
  });

  it("defaults to Chat + Vision", () => {
    expect(inferCapabilities("claude-3-opus")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
  });
});

describe("anthropic/models/listModels", () => {
  beforeEach(() => {
    modelsListMock.mockReset();
  });

  it("maps SDK models and flags reasoning ids", async () => {
    const reasoningId = anthropicInfo.thinkingModels[0] ?? "claude-thinking";
    modelsListMock.mockResolvedValueOnce({
      data: [
        { id: reasoningId, display_name: "Claude Thinking" },
        { id: "claude-2.1", display_name: "Claude 2.1" },
      ],
    });
    const out = await listModels({
      baseUrl: "https://api.anthropic.com",
      apiKey: "sk",
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: reasoningId,
      name: "Claude Thinking",
      provider: "anthropic",
      reasoning: true,
    });
    expect(out[1].capabilities).toBe(CapabilitiesUI.Chat);
  });

  it("falls back to the id when display_name is missing (Bug 83119)", async () => {
    // OpenAI-compatible proxies / test doubles serving /v1/models omit
    // Anthropic's display_name.
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "claude-sonnet-4-5" }],
    });
    const out = await listModels({
      baseUrl: "https://proxy.example.com",
      apiKey: "sk",
    });
    expect(out[0].name).toBe("claude-sonnet-4-5");
  });
});
