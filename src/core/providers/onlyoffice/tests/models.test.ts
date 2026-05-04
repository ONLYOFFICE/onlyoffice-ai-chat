import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCredentials,
  listModels,
  ONLYOFFICE_PROVIDER_ID,
} from "../models";

describe("onlyoffice/models", () => {
  const creds = { baseUrl: "https://portal.example.com", apiKey: "sk" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listModels", () => {
    it("fetches from the ONLYOFFICE REST endpoint and maps ids", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue({
          json: () =>
            Promise.resolve({
              response: [
                { modelId: "gpt-4", providerId: -1, providerTitle: "OO" },
              ],
            }),
        } as unknown as Response);

      const out = await listModels(creds);
      expect(out).toEqual([
        {
          id: "gpt-4",
          name: "gpt-4",
          provider: "onlyoffice",
          capabilities: expect.any(Number),
        },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://portal.example.com/api/2.0/ai/chats/models?provider=${ONLYOFFICE_PROVIDER_ID}`,
        expect.objectContaining({
          headers: { Authorization: "Bearer sk" },
        })
      );
    });

    it("falls back to json when `response` key is absent", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ modelId: "m" }]),
      } as unknown as Response);

      const out = await listModels(creds);
      expect(out[0].id).toBe("m");
    });

    it("omits Authorization when no apiKey", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue({
          json: () => Promise.resolve({ response: [] }),
        } as unknown as Response);
      await listModels({ baseUrl: creds.baseUrl });
      expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({});
    });
  });

  describe("checkCredentials", () => {
    it("returns true when listModels succeeds", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ response: [] }),
      } as unknown as Response);
      await expect(checkCredentials(creds)).resolves.toBe(true);
    });

    it("maps Connection error to invalidUrl", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection error.")
      );
      const out = await checkCredentials(creds);
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });

    it("maps invalid_api_key code to invalidKey", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue({
        code: "invalid_api_key",
      });
      const out = await checkCredentials(creds);
      expect(out).toEqual({ field: "key", message: "Invalid API key" });
    });

    it("falls through to emptyKey when no apiKey", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue({
        code: "unknown",
      });
      const out = await checkCredentials({ baseUrl: creds.baseUrl });
      expect(out).toEqual({ field: "key", message: "Empty key" });
    });

    it("falls through to invalidKey when apiKey present", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue({
        code: "unknown",
      });
      const out = await checkCredentials(creds);
      expect(out).toEqual({ field: "key", message: "Invalid API key" });
    });
  });
});
