import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkCredentials, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("gpt4all/models", () => {
  beforeEach(() => modelsListMock.mockReset());

  describe("listModels", () => {
    it("maps locally-installed models", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [{ id: "gpt4all-j" }] });
      const out = await listModels({ baseUrl: "http://localhost:4891/v1" });
      expect(out[0].provider).toBe("gpt4all");
    });

    it("returns [] when the SDK throws", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("stopped"));
      const out = await listModels({ baseUrl: "http://localhost:4891/v1" });
      expect(out).toEqual([]);
    });
  });

  describe("checkCredentials", () => {
    it("returns true on success", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [] });
      await expect(
        checkCredentials({ baseUrl: "http://localhost:4891/v1" })
      ).resolves.toBe(true);
    });

    it("returns invalidUrl on failure", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("x"));
      const out = await checkCredentials({
        baseUrl: "http://localhost:4891/v1",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });
  });
});
