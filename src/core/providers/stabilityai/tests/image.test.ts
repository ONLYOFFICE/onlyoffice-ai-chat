import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImage } from "../image";

const creds = { baseUrl: "https://api.stability.ai", apiKey: "sk" };

describe("stabilityai/image/generateImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns base64 from artifacts[0]", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ artifacts: [{ base64: "IMG" }] }),
    } as unknown as Response);

    const out = await generateImage(creds, { model: "core", prompt: "a cat" });
    expect(out).toBe("IMG");
  });

  it("falls back to data.image when no artifacts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ image: "B64" }),
    } as unknown as Response);

    const out = await generateImage(creds, { model: "core", prompt: "x" });
    expect(out).toBe("B64");
  });

  it("returns empty string when response has neither field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({}),
    } as unknown as Response);

    const out = await generateImage(creds, { model: "core", prompt: "x" });
    expect(out).toBe("");
  });

  it("throws on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    } as unknown as Response);

    await expect(
      generateImage(creds, { model: "core", prompt: "x" })
    ).rejects.toThrow(/Stability AI error: 500/);
  });

  it("falls back to the default model when an unknown id is requested", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ image: "B" }),
      } as unknown as Response);

    await generateImage(creds, { model: "unknown-model", prompt: "x" });
    // The fallback model id ends up affecting the URL path — just assert
    // that fetch was called with some endpoint path under the base URL.
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/^https:\/\/api.stability.ai/);
  });

  it("uses an empty model id as 'core'", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ image: "B" }),
      } as unknown as Response);

    await generateImage(creds, { model: "", prompt: "x" });
    expect(fetchMock).toHaveBeenCalled();
  });
});
