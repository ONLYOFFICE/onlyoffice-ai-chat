import { beforeEach, describe, expect, it, vi } from "vitest";
import { groqInfo } from "../info";
import { GroqProvider } from "../index";
import type { ReasoningLevel } from "../../../../shared/reasoning-level";

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
    const fieldsOf = (model: string, level: ReasoningLevel) =>
      (
        new GroqProvider({ baseUrl: "https://x", apiKey: "sk" }) as unknown as {
          reasoningRequestFields: (
            model: string,
            level: ReasoningLevel
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, level);

    it("turns Qwen reasoning off with effort=none and on with default", () => {
      expect(fieldsOf("qwen/qwen3.6-27b", "off")).toEqual({
        reasoning_effort: "none",
      });
      expect(fieldsOf("qwen/qwen3.8-27b", "medium")).toEqual({
        reasoning_effort: "default",
      });
    });

    it("sends the GPT-OSS standard depth when off, since it cannot be disabled", () => {
      expect(fieldsOf("openai/gpt-oss-120b", "off")).toEqual({
        reasoning_effort: "medium",
      });
      expect(fieldsOf("openai/gpt-oss-20b", "medium")).toEqual({
        reasoning_effort: "medium",
      });
    });

    it("sends only default / none to the Qwen models that know nothing else", () => {
      expect(fieldsOf("qwen/qwen3-32b", "high")).toEqual({
        reasoning_effort: "default",
      });
      expect(fieldsOf("qwen/qwen3-32b", "off")).toEqual({
        reasoning_effort: "none",
      });
    });

    it("passes Qwen and GPT-OSS levels through, clamping max to high", () => {
      expect(fieldsOf("qwen/qwen3.8-27b", "low")).toEqual({
        reasoning_effort: "low",
      });
      expect(fieldsOf("qwen/qwen3.8-27b", "max")).toEqual({
        reasoning_effort: "high",
      });
      expect(fieldsOf("openai/gpt-oss-120b", "high")).toEqual({
        reasoning_effort: "high",
      });
      expect(fieldsOf("openai/gpt-oss-120b", "max")).toEqual({
        reasoning_effort: "high",
      });
    });

    it("sends nothing to models without reasoning", () => {
      expect(fieldsOf("llama-3.3-70b-versatile", "medium")).toEqual({});
      expect(fieldsOf("llama-3.3-70b-versatile", "off")).toEqual({});
    });
  });
});
