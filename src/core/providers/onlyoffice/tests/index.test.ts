import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReasoningLevel } from "../../../../shared/reasoning-level";
import { onlyOfficeInfo } from "../info";
import { OnlyOfficeProvider } from "../index";

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

describe("OnlyOfficeProvider", () => {
  beforeEach(() => {
    modelsListMock.mockReset();
    chatCreateMock.mockReset();
    responsesCreateMock.mockReset();
  });

  describe("transport", () => {
    it("never probes the Responses API", async () => {
      const p = new OnlyOfficeProvider({
        baseUrl: "https://internal",
        apiKey: "k",
      });
      await expect(p.checkResponsesApi()).resolves.toBe(false);
      expect(responsesCreateMock).not.toHaveBeenCalled();
    });

    it("keeps one-shot calls on chat completions even for a profile probed onto Responses", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "t" } }],
      });
      const p = new OnlyOfficeProvider({
        baseUrl: "https://internal",
        apiKey: "k",
      });
      await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "anthropic/claude-opus-5",
        systemPrompt: "s",
        useResponsesApi: true,
        reasoningLevel: "high",
      });
      expect(responsesCreateMock).not.toHaveBeenCalled();
      const payload = chatCreateMock.mock.calls[0]?.[0];
      expect(payload.reasoning).toEqual({ effort: "high" });
      expect(payload).not.toHaveProperty("reasoning_effort");
    });
  });

  it("returns canonical name/baseUrl", () => {
    expect(OnlyOfficeProvider.getName()).toBe(onlyOfficeInfo.name);
    expect(OnlyOfficeProvider.getBaseUrl()).toBe(onlyOfficeInfo.baseUrl);
  });

  it("delegates getProviderModels", async () => {
    modelsListMock.mockResolvedValueOnce({ data: [{ id: "x" }] });
    const out = await OnlyOfficeProvider.getProviderModels({
      baseUrl: "https://internal",
      apiKey: "k",
    });
    expect(out[0].provider).toBe("onlyoffice");
  });

  describe("reasoning request fields", () => {
    // The route proxies OpenRouter one-to-one, so thinking is spelled with
    // OpenRouter's unified `reasoning` object, never OpenAI's effort field.
    const hooks = (model: string, level: ReasoningLevel) => {
      const p = new OnlyOfficeProvider({
        baseUrl: "https://internal",
        apiKey: "k",
      }) as unknown as {
        reasoningRequestFields: (
          m: string,
          l: ReasoningLevel
        ) => Record<string, unknown>;
        reasoningResponsesFields: (
          m: string,
          l: ReasoningLevel
        ) => Record<string, unknown>;
      };
      return {
        chat: p.reasoningRequestFields(model, level),
        responses: p.reasoningResponsesFields(model, level),
      };
    };

    it("uses the unified reasoning object on both transports", () => {
      const out = hooks("openai/gpt-5.2", "max");
      expect(out.chat).toEqual({ reasoning: { effort: "xhigh" } });
      expect(out.responses).toEqual({ reasoning: { effort: "xhigh" } });
      expect(out.chat).not.toHaveProperty("reasoning_effort");
    });

    it("follows OpenRouter's per-route off rules", () => {
      expect(hooks("openai/gpt-5.2", "off").chat).toEqual({
        reasoning: { effort: "none" },
      });
      expect(hooks("anthropic/claude-opus-5", "off").chat).toEqual({
        reasoning: { effort: "none" },
      });
      // Grok cannot stop upstream: off is the standard depth.
      expect(hooks("x-ai/grok-4.6", "off").chat).toEqual({
        reasoning: { effort: "medium" },
      });
    });
  });
});

describe("OnlyOfficeProvider on a route that rejects reasoning off", () => {
  const mandatory400 = {
    status: 400,
    message:
      "400 Reasoning is mandatory for this endpoint and cannot be disabled.",
  };

  beforeEach(() => {
    chatCreateMock.mockReset();
  });

  it("retries the stream once at the standard depth, cache control kept", async () => {
    async function* completed() {
      yield { choices: [{ delta: {}, finish_reason: "stop", index: 0 }] };
    }
    chatCreateMock
      .mockRejectedValueOnce(mandatory400)
      .mockResolvedValueOnce(completed());
    const p = new OnlyOfficeProvider({
      baseUrl: "https://internal",
      apiKey: "k",
    });
    for await (const _ of p.sendMessage({
      messages: [{ role: "user", content: "q" }],
      model: "deepseek/deepseek-v4-pro",
      systemPrompt: "s",
      reasoningLevel: "off",
    }))
      void _;
    expect(chatCreateMock).toHaveBeenCalledTimes(2);
    expect(chatCreateMock.mock.calls[0]?.[0]?.reasoning).toEqual({
      effort: "none",
    });
    expect(chatCreateMock.mock.calls[1]?.[0]?.reasoning).toEqual({
      effort: "medium",
    });
  });

  it("retries the one-shot call at the profile's default depth", async () => {
    chatCreateMock
      .mockRejectedValueOnce(mandatory400)
      .mockResolvedValueOnce({ choices: [{ message: { content: "t" } }] });
    const p = new OnlyOfficeProvider({
      baseUrl: "https://internal",
      apiKey: "k",
      reasoningSupport: {
        thinks: true,
        canDisable: true,
        depths: ["low", "high", "max"],
        defaultDepth: "high",
      },
    });
    await expect(
      p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "deepseek/deepseek-v4.1-flash",
        systemPrompt: "s",
        reasoningLevel: "off",
      })
    ).resolves.toBe("t");
    expect(chatCreateMock.mock.calls[1]?.[0]?.reasoning).toEqual({
      effort: "high",
    });
  });
});
