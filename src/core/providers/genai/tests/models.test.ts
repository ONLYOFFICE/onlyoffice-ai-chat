import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { inferCapabilities, isImageModel, listModels } from "../models";

const { pagerPageMock, pagerHasNextMock, pagerNextPageMock, modelsListMock } =
  vi.hoisted(() => ({
    pagerPageMock: vi.fn(),
    pagerHasNextMock: vi.fn(),
    pagerNextPageMock: vi.fn(),
    modelsListMock: vi.fn(),
  }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGenAI {
    models = { list: modelsListMock };
  },
  ThinkingLevel: { THINKING_LEVEL_UNSPECIFIED: "unspecified" },
}));

describe("genai/models/inferCapabilities", () => {
  it("marks embedContent models as Embeddings", () => {
    expect(inferCapabilities(["embedContent"])).toBe(CapabilitiesUI.Embeddings);
  });

  it("defaults to Chat + Vision + Tools", () => {
    expect(inferCapabilities(["generateContent"])).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools
    );
  });

  it("handles empty methods", () => {
    expect(inferCapabilities([])).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools
    );
  });

  it("marks Imagen models as Image via their predict method", () => {
    expect(inferCapabilities(["predict"])).toBe(CapabilitiesUI.Image);
    expect(inferCapabilities(["predictLongRunning"])).toBe(
      CapabilitiesUI.Image
    );
  });

  it("marks Gemini-native image models as Image via the model id", () => {
    // Nano Banana advertises plain `generateContent`, so only the id
    // separates it from a chat model.
    expect(
      inferCapabilities(["generateContent"], "gemini-2.5-flash-image")
    ).toBe(CapabilitiesUI.Image);
    expect(
      inferCapabilities(["generateContent"], "gemini-3-pro-image-preview")
    ).toBe(CapabilitiesUI.Image);
  });

  it("keeps ordinary Gemini models on the chat default", () => {
    expect(inferCapabilities(["generateContent"], "gemini-2.5-pro")).toBe(
      CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools
    );
  });

  it("prefers Embeddings over the image id heuristic", () => {
    expect(inferCapabilities(["embedContent"], "some-image-embedder")).toBe(
      CapabilitiesUI.Embeddings
    );
  });
});

describe("genai/models/isImageModel", () => {
  it("matches Imagen and Gemini image ids, case-insensitively", () => {
    expect(isImageModel("imagen-4.0-generate-001")).toBe(true);
    expect(isImageModel("GEMINI-2.5-FLASH-IMAGE")).toBe(true);
  });

  it("rejects chat model ids", () => {
    expect(isImageModel("gemini-2.5-pro")).toBe(false);
  });
});

describe("genai/models/listModels", () => {
  beforeEach(() => {
    pagerPageMock.mockReset();
    pagerHasNextMock.mockReset();
    pagerNextPageMock.mockReset();
    modelsListMock.mockReset();
  });

  it("walks all pages and projects each model", async () => {
    modelsListMock.mockResolvedValueOnce({
      get page() {
        return Promise.resolve([
          { name: "models/m-1", displayName: "M1" },
          {
            name: "models/m-embed",
            displayName: "M Embed",
            supportedGenerationMethods: ["embedContent"],
          },
        ]);
      },
      hasNextPage: pagerHasNextMock,
      nextPage: pagerNextPageMock,
    });
    pagerHasNextMock.mockReturnValueOnce(false);

    const out = await listModels({
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "sk",
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "m-1", name: "M1", provider: "genai" });
    expect(out[1].capabilities).toBe(CapabilitiesUI.Embeddings);
  });

  it("stops when hasNextPage reports false", async () => {
    modelsListMock.mockResolvedValueOnce({
      get page() {
        return Promise.resolve([{ name: "models/only" }]);
      },
      hasNextPage: () => false,
      nextPage: pagerNextPageMock,
    });
    await listModels({ baseUrl: "https://x", apiKey: "sk" });
    expect(pagerNextPageMock).not.toHaveBeenCalled();
  });
});
