import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { openaiInfo } from "../info";
import { inferCapabilities, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("openai/models/inferCapabilities", () => {
  it("flags Whisper and TTS as Audio", () => {
    expect(inferCapabilities("whisper-1")).toBe(CapabilitiesUI.Audio);
    expect(inferCapabilities("tts-1-hd")).toBe(CapabilitiesUI.Audio);
  });

  it("flags embedding models as Embeddings", () => {
    expect(inferCapabilities("text-embedding-ada-002")).toBe(
      CapabilitiesUI.Embeddings
    );
  });

  it("flags image models as Image", () => {
    expect(inferCapabilities("dall-e-2")).toBe(CapabilitiesUI.Image);
    expect(inferCapabilities("dall-e-3")).toBe(CapabilitiesUI.Image);
    expect(inferCapabilities("gpt-image-1")).toBe(CapabilitiesUI.Image);
  });

  it("flags gpt-3.5-turbo-instruct as Chat only", () => {
    expect(inferCapabilities("gpt-3.5-turbo-instruct")).toBe(
      CapabilitiesUI.Chat
    );
  });

  it("defaults to Chat + Vision", () => {
    expect(inferCapabilities("gpt-4o")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
  });
});

describe("openai/models/listModels", () => {
  beforeEach(() => {
    modelsListMock.mockReset();
  });

  it("maps SDK models onto our shape and flags reasoning ids", async () => {
    const reasoningId = openaiInfo.reasoningModels[0] ?? "gpt-reasoning";
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: reasoningId }, { id: "gpt-4o" }],
    });
    const out = await listModels({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-x",
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: reasoningId,
      name: reasoningId,
      provider: "openai",
      reasoning: true,
      capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Vision,
    });
    expect(out[1].reasoning).toBe(false);
  });

  it("rethrows SDK errors", async () => {
    modelsListMock.mockRejectedValueOnce(new Error("nope"));
    await expect(
      listModels({ baseUrl: "https://x", apiKey: "sk" })
    ).rejects.toThrow("nope");
  });
});
