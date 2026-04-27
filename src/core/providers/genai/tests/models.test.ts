import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { inferCapabilities, listModels } from "../models";

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
    expect(inferCapabilities(["embedContent"])).toBe(
      CapabilitiesUI.Embeddings
    );
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
