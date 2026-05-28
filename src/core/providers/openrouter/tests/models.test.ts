import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { checkCredentials, inferCapabilities, listModels } from "../models";

describe("openrouter/models/inferCapabilities", () => {
  it("defaults to Chat when no modality", () => {
    expect(inferCapabilities({ id: "x" })).toBe(CapabilitiesUI.Chat);
  });
  it("maps embedding modalities to Embeddings", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text->embedding" },
      })
    ).toBe(CapabilitiesUI.Embeddings);
  });
  it("adds Vision for image input + text output", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text+image->text" },
      })
    ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Vision);
  });
  it("adds Audio for audio input + text output", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text+audio->text" },
      })
    ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Audio);
  });
  it("sets Image when image both in and out", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "image->image" },
      })
    ).toBe(CapabilitiesUI.Image);
  });
});

describe("openrouter/models/checkCredentials", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns true on a 200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as unknown as Response);
    await expect(
      checkCredentials({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      })
    ).resolves.toBe(true);
  });

  it("maps 401 to invalidKey", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as unknown as Response);
    const out = await checkCredentials({
      baseUrl: "https://x",
      apiKey: "sk",
    });
    expect(out).toEqual({ field: "key", message: "Invalid API key" });
  });

  it("maps missing key to emptyKey", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as unknown as Response);
    const out = await checkCredentials({ baseUrl: "https://x" });
    expect(out).toEqual({ field: "key", message: "Empty key" });
  });

  it("maps other non-OK to invalidUrl", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);
    const out = await checkCredentials({
      baseUrl: "https://x",
      apiKey: "sk",
    });
    expect(out).toEqual({ field: "url", message: "Invalid URL" });
  });

  it("maps fetch rejection to connectionFailed", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    const out = await checkCredentials({
      baseUrl: "https://x",
      apiKey: "sk",
    });
    expect(out).toEqual({ field: "url", message: "Failed to connect" });
  });
});

describe("openrouter/models/listModels", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps `data` entries to Model[]", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: [{ id: "foo/bar" }, { id: "baz/qux" }],
        }),
    } as unknown as Response);
    const out = await listModels({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk",
    });
    expect(out).toHaveLength(2);
    expect(out[0].provider).toBe("openrouter");
  });

  it("omits Authorization when no apiKey", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);
    await listModels({ baseUrl: "https://x" });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({});
  });
});
