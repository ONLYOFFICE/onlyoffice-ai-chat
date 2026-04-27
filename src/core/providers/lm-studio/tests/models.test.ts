import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkCredentials, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("lm-studio/models", () => {
  beforeEach(() => modelsListMock.mockReset());

  describe("listModels", () => {
    it("maps loaded models", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [{ id: "local-1" }] });
      const out = await listModels({ baseUrl: "http://localhost:1234/v1" });
      expect(out[0].provider).toBe("lm-studio");
    });
  });

  describe("checkCredentials", () => {
    it("returns true when models are loaded", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
      await expect(
        checkCredentials({ baseUrl: "http://localhost:1234/v1" })
      ).resolves.toBe(true);
    });

    it("returns invalidUrl when the list is empty", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [] });
      const out = await checkCredentials({
        baseUrl: "http://localhost:1234/v1",
      });
      expect(out).toEqual({
        field: "url",
        message: "No models loaded in LM Studio",
      });
    });

    it("returns invalidUrl with the error message on failure", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("boom"));
      const out = await checkCredentials({
        baseUrl: "http://localhost:1234/v1",
      });
      expect(out).toEqual({ field: "url", message: "boom" });
    });

    it("returns a generic invalidUrl message on non-Error failures", async () => {
      modelsListMock.mockRejectedValueOnce("oops");
      const out = await checkCredentials({
        baseUrl: "http://localhost:1234/v1",
      });
      expect(out).toEqual({
        field: "url",
        message: "Failed to connect to LM Studio",
      });
    });
  });
});
