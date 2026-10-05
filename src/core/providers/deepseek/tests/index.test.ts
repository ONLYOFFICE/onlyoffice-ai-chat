import { beforeEach, describe, expect, it, vi } from "vitest";
import { deepseekInfo } from "../info";
import { DeepSeekProvider } from "../index";
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

describe("DeepSeekProvider", () => {
  beforeEach(() => {
    modelsListMock.mockReset();
    chatCreateMock.mockReset();
    responsesCreateMock.mockReset();
  });

  it("returns canonical name/baseUrl", () => {
    expect(DeepSeekProvider.getName()).toBe(deepseekInfo.name);
    expect(DeepSeekProvider.getBaseUrl()).toBe(deepseekInfo.baseUrl);
  });

  it("constructs with valid credentials", () => {
    expect(
      new DeepSeekProvider({ baseUrl: deepseekInfo.baseUrl, apiKey: "sk" })
    ).toBeDefined();
  });

  it("delegates getProviderModels to listModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "deepseek-chat" }] });
    const out = await DeepSeekProvider.getProviderModels({
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("deepseek");
  });

  // Bug 83335: thinking mode on the Responses transport 400s because the
  // history replay there drops reasoning — DeepSeek must stay on chat.
  describe("transport", () => {
    const provider = () =>
      new DeepSeekProvider({ baseUrl: "https://x", apiKey: "sk" });

    it("reports no Responses API without probing the network", async () => {
      await expect(provider().checkResponsesApi()).resolves.toBe(false);
      expect(responsesCreateMock).not.toHaveBeenCalled();
    });

    it("streams a profile probed onto Responses through chat completions", async () => {
      chatCreateMock.mockResolvedValueOnce(completedChat());
      for await (const _ of provider().sendMessage({
        messages: [],
        model: "deepseek-v4-flash",
        systemPrompt: "",
        useResponsesApi: true,
        withReasoning: true,
      }))
        void _;
      expect(responsesCreateMock).not.toHaveBeenCalled();
      const payload = chatCreateMock.mock.calls[0]?.[0];
      expect(payload.thinking).toEqual({ type: "enabled" });
      expect(payload).not.toHaveProperty("reasoning");
    });

    it("keeps one-shot calls on chat completions too", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "t" } }],
      });
      await provider().sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "deepseek-v4-flash",
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
        new DeepSeekProvider({
          baseUrl: "https://x",
          apiKey: "sk",
        }) as unknown as {
          reasoningRequestFields: (
            model: string,
            level: ReasoningLevel
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, level);

    it("switches V4 thinking through thinking.type, off included", () => {
      // V4 thinks by default; omitting the field leaves reasoning on.
      expect(fieldsOf("deepseek-v4-flash", "off")).toEqual({
        thinking: { type: "disabled" },
      });
      expect(fieldsOf("deepseek-v4-pro", "medium")).toEqual({
        thinking: { type: "enabled" },
      });
    });

    it("sends the DeepSeek effort scale for low / high / max", () => {
      expect(fieldsOf("deepseek-v4-pro", "low")).toEqual({
        thinking: { type: "enabled" },
        reasoning_effort: "low",
      });
      expect(fieldsOf("deepseek-v4-pro", "max")).toEqual({
        thinking: { type: "enabled" },
        reasoning_effort: "max",
      });
      // The always-thinking alias takes neither a switch nor a depth.
      expect(fieldsOf("deepseek-reasoner", "high")).toEqual({});
    });

    it("never sends reasoning_effort (DeepSeek has no medium)", () => {
      expect(fieldsOf("deepseek-v4-pro", "medium")).not.toHaveProperty(
        "reasoning_effort"
      );
    });

    it("leaves the always-thinking reasoner alias alone", () => {
      expect(fieldsOf("deepseek-reasoner", "off")).toEqual({});
      expect(fieldsOf("deepseek-reasoner", "medium")).toEqual({});
    });
  });
});
