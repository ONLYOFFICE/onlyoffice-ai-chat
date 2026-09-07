import { beforeEach, describe, expect, it, vi } from "vitest";
import { groqInfo } from "../info";
import { GroqProvider } from "../index";

const { modelsListMock } = vi.hoisted(() => ({ modelsListMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
  },
}));

describe("GroqProvider", () => {
  beforeEach(() => modelsListMock.mockReset());

  it("returns canonical name/baseUrl", () => {
    expect(GroqProvider.getName()).toBe(groqInfo.name);
    expect(GroqProvider.getBaseUrl()).toBe(groqInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({
      data: [{ id: "llama3-8b" }],
    });
    const out = await GroqProvider.getProviderModels({
      baseUrl: groqInfo.baseUrl,
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("groq");
  });
  describe("reasoning request fields", () => {
    const fieldsOf = (model: string, withReasoning?: boolean) =>
      (
        new GroqProvider({ baseUrl: "https://x", apiKey: "sk" }) as unknown as {
          reasoningRequestFields: (
            model: string,
            withReasoning?: boolean
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, withReasoning);

    it("turns Qwen reasoning off with effort=none and on with default", () => {
      expect(fieldsOf("qwen/qwen3.6-27b", false)).toEqual({
        reasoning_effort: "none",
      });
      expect(fieldsOf("qwen/qwen3.8-27b", true)).toEqual({
        reasoning_effort: "default",
      });
    });

    it("hides GPT-OSS reasoning when off, since it cannot be disabled", () => {
      expect(fieldsOf("openai/gpt-oss-120b", false)).toEqual({
        include_reasoning: false,
      });
      expect(fieldsOf("openai/gpt-oss-20b", true)).toEqual({
        reasoning_effort: "medium",
      });
    });

    it("sends nothing to models without reasoning", () => {
      expect(fieldsOf("llama-3.3-70b-versatile", true)).toEqual({});
      expect(fieldsOf("llama-3.3-70b-versatile", false)).toEqual({});
    });
  });
});
