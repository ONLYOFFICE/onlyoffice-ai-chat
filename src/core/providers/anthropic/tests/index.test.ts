import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { anthropicInfo } from "../info";
import { AnthropicProvider } from "../index";

const { messagesCreateMock, modelsListMock } = vi.hoisted(() => ({
  messagesCreateMock: vi.fn(),
  modelsListMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: messagesCreateMock };
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

const makeEv = <T extends object>(ev: T) => ev as unknown as never;

describe("AnthropicProvider", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
    modelsListMock.mockReset();
  });

  describe("static identity", () => {
    it("returns the canonical name", () => {
      expect(AnthropicProvider.getName()).toBe(anthropicInfo.name);
    });
    it("returns the canonical baseUrl", () => {
      expect(AnthropicProvider.getBaseUrl()).toBe(anthropicInfo.baseUrl);
    });
  });

  describe("sendMessage", () => {
    it("streams events and yields isEnd on message_stop", async () => {
      messagesCreateMock.mockResolvedValueOnce(
        iter([
          makeEv({ type: "message_start", message: { role: "assistant" } }),
          makeEv({
            type: "content_block_start",
            content_block: { type: "text", text: "hi" },
          }),
          makeEv({ type: "message_stop" }),
        ])
      );
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [{ role: "user", content: "q" }],
          model: "claude-3-opus",
          systemPrompt: "be nice",
        })
      );
      const last = frames[frames.length - 1] as {
        isEnd: true;
        responseMessage: ThreadMessageLike;
      };
      expect(last.isEnd).toBe(true);
    });

    it("enables thinking when withReasoning is set", async () => {
      messagesCreateMock.mockResolvedValueOnce(
        iter([makeEv({ type: "message_stop" })])
      );
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      await drain(
        p.sendMessage({
          messages: [],
          model: "claude-3-opus",
          systemPrompt: "",
          withReasoning: true,
        })
      );
      expect(messagesCreateMock.mock.calls[0]?.[0]?.thinking?.type).toBe(
        "enabled"
      );
    });

    it("attaches tools with auto tool_choice", async () => {
      messagesCreateMock.mockResolvedValueOnce(
        iter([makeEv({ type: "message_stop" })])
      );
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      await drain(
        p.sendMessage({
          messages: [],
          model: "claude-3-opus",
          systemPrompt: "",
          tools: [{ name: "t", description: "d", inputSchema: {} }],
        })
      );
      expect(messagesCreateMock.mock.calls[0]?.[0]?.tool_choice?.type).toBe(
        "auto"
      );
    });

    it("yields cancelled on abort", async () => {
      const err = new Error("abort");
      err.name = "AbortError";
      messagesCreateMock.mockRejectedValueOnce(err);
      const ac = new AbortController();
      ac.abort();
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "claude-3-opus",
          systemPrompt: "",
          signal: ac.signal,
        })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("cancelled");
    });

    it("yields error when SDK throws", async () => {
      messagesCreateMock.mockRejectedValueOnce(new Error("boom"));
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "claude-3-opus",
          systemPrompt: "",
        })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("error");
    });
  });

  describe("sendMessageSync", () => {
    it("concatenates text blocks from the response", async () => {
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: " world" },
        ],
      });
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      const text = await p.sendMessageSync({
        messages: [],
        model: "claude",
        systemPrompt: "",
      });
      expect(text).toBe("hello world");
    });

    it("returns empty string when SDK throws", async () => {
      messagesCreateMock.mockRejectedValueOnce(new Error("x"));
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "claude",
          systemPrompt: "",
        })
      ).toBe("");
    });
  });

  describe("static checkProvider", () => {
    it("returns true on success", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [] });
      await expect(
        AnthropicProvider.checkProvider({
          baseUrl: "https://api.anthropic.com",
          apiKey: "sk",
        })
      ).resolves.toBe(true);
    });

    it("maps 401 to invalidKey", async () => {
      modelsListMock.mockRejectedValueOnce({
        status: 401,
        error: { error: { message: "bad key" } },
      });
      const out = await AnthropicProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "key", message: "bad key" });
    });

    it("maps 404 to invalidUrl", async () => {
      modelsListMock.mockRejectedValueOnce({ status: 404 });
      const out = await AnthropicProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });

    it("maps network error (cause) to invalidUrl", async () => {
      modelsListMock.mockRejectedValueOnce({ cause: new Error("net") });
      const out = await AnthropicProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });

    it("maps generic error without key to emptyKey", async () => {
      modelsListMock.mockRejectedValueOnce({ status: 500 });
      const out = await AnthropicProvider.checkProvider({
        baseUrl: "https://x",
      });
      expect(out).toEqual({ field: "key", message: "Empty key" });
    });
  });

  describe("static getProviderModels", () => {
    it("delegates to listModels", async () => {
      modelsListMock.mockResolvedValueOnce({
        data: [{ id: "claude-3", display_name: "C3" }],
      });
      const out = await AnthropicProvider.getProviderModels({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      expect(out[0]).toMatchObject({
        id: "claude-3",
        name: "C3",
        provider: "anthropic",
      });
    });
  });
});
