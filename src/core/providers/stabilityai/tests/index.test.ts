import { beforeEach, describe, expect, it, vi } from "vitest";
import { stabilityaiInfo } from "../info";
import { StabilityAIProvider } from "../index";

describe("StabilityAIProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("static identity", () => {
    it("returns canonical name", () => {
      expect(StabilityAIProvider.getName()).toBe(stabilityaiInfo.name);
    });
    it("returns canonical baseUrl", () => {
      expect(StabilityAIProvider.getBaseUrl()).toBe(stabilityaiInfo.baseUrl);
    });
  });

  describe("chat surface throws NotSupported", () => {
    const p = new StabilityAIProvider({
      baseUrl: "https://api.stability.ai",
      apiKey: "sk",
    });

    it("sendMessage throws", async () => {
      await expect(async () => {
        const gen = p.sendMessage();
        await gen.next();
      }).rejects.toThrow("Stability AI does not support chat");
    });

    it("sendMessageSync throws", async () => {
      await expect(p.sendMessageSync()).rejects.toThrow(
        "Stability AI does not support chat"
      );
    });
  });

  describe("imageGeneration", () => {
    it("delegates to generateImage and returns the base64 payload", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ image: "B64" }),
      } as unknown as Response);

      const p = new StabilityAIProvider({
        baseUrl: "https://api.stability.ai",
        apiKey: "sk",
      });
      const out = await p.imageGeneration({ model: "core", prompt: "cat" });
      expect(out).toBe("B64");
    });
  });

  describe("static checkProvider & getProviderModels", () => {
    it("returns the curated model list", async () => {
      const out = await StabilityAIProvider.getProviderModels();
      expect(out.length).toBeGreaterThan(0);
    });

    it("returns true on 200", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 200,
      } as unknown as Response);
      await expect(
        StabilityAIProvider.checkProvider({
          baseUrl: "https://api.stability.ai",
          apiKey: "sk",
        })
      ).resolves.toBe(true);
    });
  });
});
