import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import { stabilityaiInfo } from "../info";
import { checkCredentials, listModels } from "../models";

describe("stabilityai/models", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listModels", () => {
    it("returns the curated image model list", async () => {
      const out = await listModels();
      expect(out).toHaveLength(stabilityaiInfo.models.length);
      for (const m of out) {
        expect(m.provider).toBe("stabilityai");
        expect(m.capabilities).toBe(CapabilitiesUI.Image);
      }
    });
  });

  describe("checkCredentials", () => {
    it("returns true on any non-401 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 200,
      } as unknown as Response);
      await expect(
        checkCredentials({ baseUrl: "https://api.stability.ai", apiKey: "sk" })
      ).resolves.toBe(true);
    });

    it("returns invalidKey on 401", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 401,
      } as unknown as Response);
      const out = await checkCredentials({
        baseUrl: "https://api.stability.ai",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "key", message: "Invalid API key" });
    });

    it("maps network errors via mapFetchError", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("network down")
      );
      const out = await checkCredentials({
        baseUrl: "https://api.stability.ai",
        apiKey: "sk",
      });
      expect(out).toHaveProperty("field");
    });
  });
});
