import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { mistralInfo } from "../info";
import {
  inferCapabilities,
  listModels,
  resolveReasoningModel,
} from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("@mistralai/mistralai", () => ({
  Mistral: class MockMistral {
    models = { list: modelsListMock };
  },
}));

describe("mistral/models/inferCapabilities", () => {
  it("flags mistral-embed as Embeddings", () => {
    expect(inferCapabilities({ id: "mistral-embed" })).toBe(
      CapabilitiesUI.Embeddings
    );
  });
  it("flags pixtral as Chat + Vision", () => {
    expect(inferCapabilities({ id: "pixtral-large-latest" })).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
  });
  it("flags mistral-small / medium / codestral as Chat only", () => {
    expect(inferCapabilities({ id: "mistral-small-latest" })).toBe(
      CapabilitiesUI.Chat
    );
    expect(inferCapabilities({ id: "mistral-medium-latest" })).toBe(
      CapabilitiesUI.Chat
    );
    expect(inferCapabilities({ id: "codestral-latest" })).toBe(
      CapabilitiesUI.Chat
    );
  });
  it("adds Vision when capabilities.vision is reported", () => {
    expect(
      inferCapabilities({ id: "mistral-large", capabilities: { vision: true } })
    ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Vision);
  });
  it("defaults to Chat only", () => {
    expect(inferCapabilities({ id: "unknown" })).toBe(CapabilitiesUI.Chat);
  });
});

describe("mistral/models/resolveReasoningModel", () => {
  it("rewrites to the reasoning variant for a known level", () => {
    const [level, variant] = mistralInfo.reasoningModels[0] ?? ["", ""];
    if (!level) return;
    expect(resolveReasoningModel(level)).toBe(variant);
  });

  it("returns the original model id when no level matches", () => {
    expect(resolveReasoningModel("random-model")).toBe("random-model");
  });
});

describe("mistral/models/listModels", () => {
  beforeEach(() => {
    modelsListMock.mockReset();
  });

  it("maps the SDK response onto Model[]", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "mistral-small-latest" }, { id: "pixtral-large-latest" }],
    });
    const out = await listModels({
      baseUrl: "https://api.mistral.ai",
      apiKey: "sk",
    });
    expect(out).toHaveLength(2);
    expect(out[0].provider).toBe("mistral");
    expect(out[1].capabilities).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
  });

  it("handles a missing data property by returning []", async () => {
    modelsListMock.mockResolvedValueOnce({});
    const out = await listModels({
      baseUrl: "https://api.mistral.ai",
      apiKey: "sk",
    });
    expect(out).toEqual([]);
  });

  it("uses fallback id and name when a model has no id", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{}] });
    const out = await listModels({
      baseUrl: "https://api.mistral.ai",
      apiKey: "sk",
    });
    expect(out[0]).toMatchObject({ id: "", name: "Unknown" });
  });
});
