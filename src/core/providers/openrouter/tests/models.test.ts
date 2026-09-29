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
  it("adds Tools when supported_parameters lists tools", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text->text" },
        supported_parameters: ["temperature", "tools", "tool_choice"],
      })
    ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Tools);
  });
  it("omits Tools when supported_parameters lacks tools", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text->text" },
        supported_parameters: ["temperature", "top_p"],
      })
    ).toBe(CapabilitiesUI.Chat);
  });
  it("applies Tools even without any modality metadata", () => {
    expect(
      inferCapabilities({ id: "x", supported_parameters: ["tools"] })
    ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Tools);
  });
  it("keeps Embeddings exclusive of Tools", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text->embedding" },
        supported_parameters: ["tools"],
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
  it("sets Image for text-to-image models (image out only)", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: { modality: "text->image" },
      })
    ).toBe(CapabilitiesUI.Image);
  });
  it("uses input_modalities/output_modalities arrays over modality string", () => {
    expect(
      inferCapabilities({
        id: "x",
        architecture: {
          modality: "text->text",
          input_modalities: ["text", "image"],
          output_modalities: ["text"],
        },
      })
    ).toBe(CapabilitiesUI.Chat | CapabilitiesUI.Vision);
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
      ok: true,
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
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);
    await listModels({ baseUrl: "https://x" });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({});
  });

  it("reads the catalogue's reasoning object, falling back to the info list without it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "x-ai/grok-4.6",
              reasoning: {
                mandatory: true,
                supported_efforts: ["high", "low"],
                default_effort: "high",
              },
            },
            { id: "openai/gpt-4o", reasoning: null },
            { id: "openai/gpt-5.2" },
          ],
        }),
    } as unknown as Response);
    const out = await listModels({ baseUrl: "https://x", apiKey: "sk" });
    expect(out[0].reasoning).toBe(true);
    expect(out[0].reasoningSupport).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "high"],
      defaultDepth: "high",
    });
    expect(out[1].reasoning).toBe(false);
    expect(out[1].reasoningSupport?.thinks).toBe(false);
    // No field at all: the static info list decides, no support record.
    expect(out[2].reasoning).toBe(true);
    expect(out[2].reasoningSupport).toBeUndefined();
  });

  it("requests the usage-ranked catalogue without truncating it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);
    await listModels({ baseUrl: "https://openrouter.ai/api/v1" });

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe("/api/v1/models");
    expect(requested.searchParams.get("sort")).toBe("most-popular");
    // The endpoint defaults to 500 and the catalogue is already ~460.
    expect(requested.searchParams.get("limit")).toBe("1000");
  });

  it("keeps the query intact when baseUrl has a trailing slash", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);
    await listModels({ baseUrl: "https://openrouter.ai/api/v1/" });

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe("/api/v1/models");
    expect(requested.searchParams.get("sort")).toBe("most-popular");
  });

  it("preserves the server's ranking order", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ id: "most/used" }, { id: "mid/used" }, { id: "least/used" }],
        }),
    } as unknown as Response);
    const out = await listModels({ baseUrl: "https://x" });

    // The ranking exists only as the array order — nothing may reorder it.
    expect(out.map((m) => m.id)).toEqual([
      "most/used",
      "mid/used",
      "least/used",
    ]);
  });
});
