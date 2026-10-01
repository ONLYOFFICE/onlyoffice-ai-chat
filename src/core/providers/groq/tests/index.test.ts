import { beforeEach, describe, expect, it, vi } from "vitest";
import { groqInfo } from "../info";
import { GroqProvider } from "../index";
import type { ReasoningLevel } from "../../../../shared/reasoning-level";

const { modelsListMock, chatCreateMock, responsesCreateMock } = vi.hoisted(
  () => ({
    modelsListMock: vi.fn(),
    chatCreateMock: vi.fn(),
    responsesCreateMock: vi.fn(),
  })
);

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: modelsListMock };
    chat = { completions: { create: chatCreateMock } };
    responses = { create: responsesCreateMock };
  },
}));

/** A finished chat-completions stream: one empty chunk with a stop. */
async function* completedChat() {
  yield {
    choices: [{ delta: {}, finish_reason: "stop", index: 0 }],
  };
}

describe("GroqProvider", () => {
  beforeEach(() => {
    modelsListMock.mockReset();
    chatCreateMock.mockReset();
    responsesCreateMock.mockReset();
  });

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
  describe("transport", () => {
    const provider = () =>
      new GroqProvider({ baseUrl: "https://x", apiKey: "sk" });

    it("reports no Responses API without probing the network", async () => {
      await expect(provider().checkResponsesApi()).resolves.toBe(false);
      expect(responsesCreateMock).not.toHaveBeenCalled();
    });

    it("streams a profile probed onto Responses through chat completions", async () => {
      chatCreateMock.mockResolvedValueOnce(completedChat());
      for await (const _ of provider().sendMessage({
        messages: [],
        model: "openai/gpt-oss-120b",
        systemPrompt: "",
        useResponsesApi: true,
        withReasoning: true,
      }))
        void _;
      expect(responsesCreateMock).not.toHaveBeenCalled();
      const payload = chatCreateMock.mock.calls[0]?.[0];
      expect(payload.reasoning_effort).toBe("medium");
      expect(payload).not.toHaveProperty("reasoning");
    });

    it("keeps one-shot calls on chat completions too", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "t" } }],
      });
      await provider().sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "openai/gpt-oss-120b",
        systemPrompt: "s",
        useResponsesApi: true,
      });
      expect(responsesCreateMock).not.toHaveBeenCalled();
      expect(chatCreateMock).toHaveBeenCalledTimes(1);
    });
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
