import { beforeEach, describe, expect, it, vi } from "vitest";
import { openrouterInfo } from "../info";
import { OpenRouterProvider } from "../index";

describe("OpenRouterProvider", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns canonical name/baseUrl", () => {
    expect(OpenRouterProvider.getName()).toBe(openrouterInfo.name);
    expect(OpenRouterProvider.getBaseUrl()).toBe(openrouterInfo.baseUrl);
  });

  it("delegates checkProvider", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as unknown as Response);
    await expect(
      OpenRouterProvider.checkProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      })
    ).resolves.toBe(true);
  });

  it("delegates getProviderModels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ data: [{ id: "x/y" }] }),
    } as unknown as Response);
    const out = await OpenRouterProvider.getProviderModels({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("openrouter");
  });

  describe("imageGeneration", () => {
    function makeProvider(createImpl: (...args: unknown[]) => unknown) {
      const provider = new OpenRouterProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      });
      (
        provider as unknown as {
          client: { chat: { completions: { create: unknown } } };
        }
      ).client = {
        chat: {
          completions: { create: vi.fn(createImpl) },
        },
      };
      return provider;
    }

    it("strips data-URI prefix and returns raw base64", async () => {
      const provider = makeProvider(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "data:image/png;base64,AAA" } },
                ],
              },
            },
          ],
        })
      );
      const out = await provider.imageGeneration({
        model: "openai/gpt-4o-image",
        prompt: "kitten",
      });
      expect(out).toBe("AAA");
    });

    it("returns the URL as-is when not a data URI", async () => {
      const provider = makeProvider(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "https://cdn.example.com/i.png" } },
                ],
              },
            },
          ],
        })
      );
      const out = await provider.imageGeneration({
        model: "x",
        prompt: "p",
      });
      expect(out).toBe("https://cdn.example.com/i.png");
    });

    it("returns empty string when the response has no images", async () => {
      const provider = makeProvider(() =>
        Promise.resolve({ choices: [{ message: {} }] })
      );
      const out = await provider.imageGeneration({ model: "x", prompt: "p" });
      expect(out).toBe("");
    });

    it("returns empty string when the request is aborted", async () => {
      const controller = new AbortController();
      const provider = makeProvider(() => {
        controller.abort();
        const err = new Error("aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });
      const out = await provider.imageGeneration({
        model: "x",
        prompt: "p",
        signal: controller.signal,
      });
      expect(out).toBe("");
    });

    it("rethrows non-abort errors", async () => {
      const provider = makeProvider(() =>
        Promise.reject(new Error("boom"))
      );
      await expect(
        provider.imageGeneration({ model: "x", prompt: "p" })
      ).rejects.toThrow("boom");
    });
  });
});
