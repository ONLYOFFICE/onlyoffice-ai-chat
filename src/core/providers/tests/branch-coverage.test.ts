/**
 * Targeted tests that exercise branches the per-provider test files
 * don't reach. Kept in one place because each scenario is just a
 * one-liner of "what happens with empty baseUrl" or similar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import { listModels as deepseekListModels } from "../deepseek/models";
import { listModels as gpt4allListModels } from "../gpt4all/models";
import {
  inferCapabilities as groqInferCapabilities,
  listModels as groqListModels,
} from "../groq/models";
import { listModels as xaiListModels } from "../xai/models";
import {
  inferCapabilities as zhipuInferCapabilities,
  listModels as zhipuListModels,
} from "../zhipu/models";
import { inferCapabilities as openrouterInferCapabilities } from "../openrouter/models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

beforeEach(() => modelsListMock.mockReset());

describe("provider listModels — defaults to baseUrl when caller passes empty", () => {
  it("deepseek defaults baseUrl", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
    const out = await deepseekListModels({ baseUrl: "", apiKey: "sk" });
    expect(out).toHaveLength(1);
  });

  it("gpt4all defaults baseUrl", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
    const out = await gpt4allListModels({ baseUrl: "" });
    expect(out).toHaveLength(1);
  });

  it("groq defaults baseUrl + filters whisper entries", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "whisper-large" }, { id: "llama-3.3" }],
    });
    const out = await groqListModels({ baseUrl: "", apiKey: "sk" });
    expect(out.map((m) => m.id)).toEqual(["llama-3.3"]);
  });

  it("xai defaults baseUrl + classifies image and reasoning ids", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [
        { id: "grok-image-2" },
        { id: "grok-vision-beta" },
        { id: "grok-reasoning-1" },
        { id: "grok-4" },
      ],
    });
    const out = await xaiListModels({ baseUrl: "", apiKey: "sk" });
    // reversed
    expect(out[0].id).toBe("grok-4");
    const map = Object.fromEntries(out.map((m) => [m.id, m]));
    expect(map["grok-image-2"].capabilities).toBe(CapabilitiesUI.Image);
    expect(map["grok-vision-beta"].capabilities).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision
    );
    expect(map["grok-reasoning-1"].reasoning).toBe(true);
  });

  it("zhipu defaults baseUrl on success path", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "glm-4-plus" }],
    });
    const out = await zhipuListModels({ baseUrl: "", apiKey: "sk" });
    expect(out).toHaveLength(1);
  });

  it("zhipu falls back to FALLBACK_MODELS on error", async () => {
    modelsListMock.mockRejectedValueOnce(new Error("boom"));
    const out = await zhipuListModels({ baseUrl: "https://x", apiKey: "sk" });
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((m) => m.id === "glm-4")).toBe(true);
  });
});

describe("groq inferCapabilities", () => {
  it("returns Chat | Tools by default", () => {
    expect(groqInferCapabilities("llama-3.3")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools
    );
  });

  it("adds Vision when id contains vision", () => {
    expect(groqInferCapabilities("llava-vision")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools | CapabilitiesUI.Vision
    );
  });
});

describe("zhipu inferCapabilities", () => {
  it("returns Chat | Tools by default", () => {
    expect(zhipuInferCapabilities("glm-4")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Tools
    );
  });

  it("returns Image for cogview", () => {
    expect(zhipuInferCapabilities("cogview-3")).toBe(CapabilitiesUI.Image);
  });

  it("returns Image for ids containing 'image'", () => {
    expect(zhipuInferCapabilities("glm-image")).toBe(CapabilitiesUI.Image);
  });

  it("normalises to lowercase", () => {
    expect(zhipuInferCapabilities("COGVIEW-3")).toBe(CapabilitiesUI.Image);
  });
});

describe("openrouter inferCapabilities — extra branches", () => {
  it("falls back to Chat when output is image but input is not", () => {
    expect(
      openrouterInferCapabilities({
        id: "x",
        architecture: { modality: "text->image" },
      })
    ).toBe(CapabilitiesUI.Chat);
  });

  it("returns Embeddings when input is embedding", () => {
    expect(
      openrouterInferCapabilities({
        id: "x",
        architecture: { modality: "embedding->text" },
      })
    ).toBe(CapabilitiesUI.Embeddings);
  });

  it("falls back to Chat when modality has no recognized parts", () => {
    expect(
      openrouterInferCapabilities({
        id: "x",
        architecture: { modality: "garbage->garbage" },
      })
    ).toBe(CapabilitiesUI.Chat);
  });
});
