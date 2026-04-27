import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkCredentials, listModels } from "../models";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("ollama/models", () => {
  beforeEach(() => modelsListMock.mockReset());

  describe("listModels", () => {
    it("maps SDK models with the broad default capabilities", async () => {
      modelsListMock.mockResolvedValueOnce({
        data: [{ id: "llama3" }, { id: "mistral" }],
      });
      const out = await listModels({ baseUrl: "http://localhost:11434/v1" });
      expect(out).toHaveLength(2);
      expect(out[0].provider).toBe("ollama");
    });
  });

  describe("checkCredentials", () => {
    it("returns true when listing succeeds", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [] });
      await expect(
        checkCredentials({ baseUrl: "http://localhost:11434/v1" })
      ).resolves.toBe(true);
    });

    it("returns invalidUrl on failure", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("nope"));
      const out = await checkCredentials({
        baseUrl: "http://localhost:11434/v1",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });
  });
});
