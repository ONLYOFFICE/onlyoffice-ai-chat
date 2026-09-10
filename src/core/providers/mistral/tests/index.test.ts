import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mistralInfo } from "../info";
import { MistralProvider } from "../index";

const { chatStreamMock, chatCompleteMock, modelsListMock } = vi.hoisted(() => ({
  chatStreamMock: vi.fn(),
  chatCompleteMock: vi.fn(),
  modelsListMock: vi.fn(),
}));

vi.mock("@mistralai/mistralai", () => ({
  Mistral: class MockMistral {
    chat = { stream: chatStreamMock, complete: chatCompleteMock };
    models = { list: modelsListMock };
  },
}));

async function* iter<T>(items: T[]) {
  for (const it of items) yield it;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

const event = (delta: Record<string, unknown>, finishReason?: string) => ({
  data: {
    choices: [{ index: 0, delta, finishReason: finishReason ?? null }],
  },
});

describe("MistralProvider", () => {
  beforeEach(() => {
    chatStreamMock.mockReset();
    chatCompleteMock.mockReset();
    modelsListMock.mockReset();
  });

  describe("static identity", () => {
    it("returns canonical name", () => {
      expect(MistralProvider.getName()).toBe(mistralInfo.name);
    });
    it("returns canonical baseUrl", () => {
      expect(MistralProvider.getBaseUrl()).toBe(mistralInfo.baseUrl);
    });
  });

  describe("sendMessage", () => {
    it("streams deltas and yields isEnd on stop", async () => {
      chatStreamMock.mockResolvedValueOnce(
        iter([event({ content: "hi" }), event({}, "stop")])
      );
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [{ role: "user", content: "q" }],
          model: "mistral-large",
          systemPrompt: "",
        })
      );
      const last = frames[frames.length - 1] as unknown as {
        isEnd: true;
        responseMessage: ThreadMessageLike;
      };
      expect(last.isEnd).toBe(true);
      expect(last.responseMessage.content).toEqual([
        { type: "text", text: "hi" },
      ]);
    });

    it("resolves the reasoning model alias when withReasoning is set", async () => {
      chatStreamMock.mockResolvedValueOnce(iter([event({}, "stop")]));
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      const [level, variant] = mistralInfo.reasoningModels[0] ?? ["", ""];
      if (!level) return;

      await drain(
        p.sendMessage({
          messages: [],
          model: level,
          systemPrompt: "",
          withReasoning: true,
        })
      );
      expect(chatStreamMock.mock.calls[0]?.[0]?.model).toBe(variant);
    });

    it("attaches tools when provided", async () => {
      chatStreamMock.mockResolvedValueOnce(iter([event({}, "stop")]));
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      await drain(
        p.sendMessage({
          messages: [],
          model: "mistral-large",
          systemPrompt: "",
          tools: [{ name: "t", description: "d", inputSchema: {} }],
        })
      );
      expect(chatStreamMock.mock.calls[0]?.[0]?.tools?.length).toBe(1);
      expect(chatStreamMock.mock.calls[0]?.[0]?.parallelToolCalls).toBe(false);
    });

    it("yields cancelled on abort", async () => {
      const err = new Error("x");
      err.name = "AbortError";
      chatStreamMock.mockRejectedValueOnce(err);
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "mistral-large",
          systemPrompt: "",
        })
      );
      const last = frames[frames.length - 1] as unknown as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("cancelled");
    });

    it("yields error on generic exception", async () => {
      chatStreamMock.mockRejectedValueOnce(new Error("fail"));
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "mistral-large",
          systemPrompt: "",
        })
      );
      const last = frames[frames.length - 1] as unknown as {
        responseMessage: {
          status?: { type?: string; reason?: string };
        };
      };
      expect(last.responseMessage.status?.type).toBe("incomplete");
      expect(last.responseMessage.status?.reason).toBe("error");
      expect(JSON.stringify(last.responseMessage.status)).toContain("fail");
    });
  });

  describe("sendMessageSync", () => {
    it("returns message content on success", async () => {
      chatCompleteMock.mockResolvedValueOnce({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "mistral-large",
          systemPrompt: "",
        })
      ).toBe("answer");
    });

    it("returns empty string on non-string content", async () => {
      chatCompleteMock.mockResolvedValueOnce({
        choices: [{ message: { content: [{ type: "text", text: "x" }] } }],
      });
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "mistral-large",
          systemPrompt: "",
        })
      ).toBe("");
    });

    it("rethrows on error", async () => {
      chatCompleteMock.mockRejectedValueOnce(new Error("x"));
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      await expect(
        p.sendMessageSync({
          messages: [],
          model: "mistral-large",
          systemPrompt: "",
        })
      ).rejects.toThrow("x");
    });

    it("resolves the reasoning model alias when withReasoning is set", async () => {
      chatCompleteMock.mockResolvedValueOnce({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new MistralProvider({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      const [level, variant] = mistralInfo.reasoningModels[0] ?? ["", ""];
      if (!level) return;

      await p.sendMessageSync({
        messages: [],
        model: level,
        systemPrompt: "",
        withReasoning: true,
      });
      expect(chatCompleteMock.mock.calls[0]?.[0]?.model).toBe(variant);
    });
  });

  describe("static checkProvider", () => {
    it("returns true on success", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [] });
      await expect(
        MistralProvider.checkProvider({
          baseUrl: "https://api.mistral.ai",
          apiKey: "sk",
        })
      ).resolves.toBe(true);
    });

    it("maps 401 to invalidKey with a message", async () => {
      modelsListMock.mockRejectedValueOnce({
        status: 401,
        error: { error: { message: "bad" } },
      });
      const out = await MistralProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "key", message: "bad" });
    });

    it("maps network-style errors to invalidUrl", async () => {
      modelsListMock.mockRejectedValueOnce({ cause: new Error("net") });
      const out = await MistralProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect((out as { field: string }).field).toBe("url");
    });

    it("maps 404 to invalidUrl", async () => {
      modelsListMock.mockRejectedValueOnce({ status: 404 });
      const out = await MistralProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect((out as { field: string }).field).toBe("url");
    });

    it("falls through to emptyKey when no key", async () => {
      modelsListMock.mockRejectedValueOnce({ status: 500 });
      const out = await MistralProvider.checkProvider({
        baseUrl: "https://x",
      });
      expect(out).toEqual({ field: "key", message: "Empty key" });
    });
  });

  describe("static getProviderModels", () => {
    it("delegates to listModels", async () => {
      modelsListMock.mockResolvedValueOnce({
        data: [{ id: "mistral-large" }],
      });
      const out = await MistralProvider.getProviderModels({
        baseUrl: "https://api.mistral.ai",
        apiKey: "sk",
      });
      expect(out[0].id).toBe("mistral-large");
    });
  });

  describe("reasoning level", () => {
    it("swaps to Magistral for any depth and lets the level win over the boolean", async () => {
      chatCompleteMock.mockResolvedValue({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new MistralProvider({ baseUrl: "https://api.mistral.ai" });
      await p.sendMessageSync({
        messages: [],
        model: "mistral-large",
        systemPrompt: "",
        reasoningLevel: "low",
      });
      expect(chatCompleteMock.mock.calls.at(-1)?.[0]?.model).toBe(
        "magistral-medium-latest"
      );
      await p.sendMessageSync({
        messages: [],
        model: "mistral-large",
        systemPrompt: "",
        withReasoning: true,
        reasoningLevel: "off",
      });
      expect(chatCompleteMock.mock.calls.at(-1)?.[0]?.model).toBe(
        "mistral-large"
      );
    });
  });
});
