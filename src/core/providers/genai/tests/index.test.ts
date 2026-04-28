import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { genaiInfo } from "../info";
import { GenAIProvider } from "../index";

const {
  generateContentStreamMock,
  generateContentMock,
  modelsListMock,
} = vi.hoisted(() => ({
  generateContentStreamMock: vi.fn(),
  generateContentMock: vi.fn(),
  modelsListMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGenAI {
    models = {
      generateContent: generateContentMock,
      generateContentStream: generateContentStreamMock,
      list: modelsListMock,
    };
  },
  ThinkingLevel: { THINKING_LEVEL_UNSPECIFIED: "unspecified" },
}));

async function* iter<T>(items: T[]) {
  for (const it of items) yield it;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

const makeChunk = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }],
});

describe("GenAIProvider", () => {
  beforeEach(() => {
    generateContentStreamMock.mockReset();
    generateContentMock.mockReset();
    modelsListMock.mockReset();
  });

  describe("static identity", () => {
    it("returns canonical name", () => {
      expect(GenAIProvider.getName()).toBe(genaiInfo.name);
    });
    it("returns canonical baseUrl", () => {
      expect(GenAIProvider.getBaseUrl()).toBe(genaiInfo.baseUrl);
    });
  });

  describe("sendMessage", () => {
    it("streams chunks and yields isEnd", async () => {
      generateContentStreamMock.mockResolvedValueOnce(
        iter([makeChunk("hi"), makeChunk("!")])
      );
      const p = new GenAIProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [{ role: "user", content: "q" }],
          model: "gemini",
          systemPrompt: "",
        })
      );
      const last = frames[frames.length - 1] as {
        isEnd: true;
        responseMessage: ThreadMessageLike;
      };
      expect(last.isEnd).toBe(true);
      expect(last.responseMessage.content).toEqual([
        { type: "text", text: "hi!" },
      ]);
    });

    it("enables thinking config when withReasoning is set", async () => {
      generateContentStreamMock.mockResolvedValueOnce(iter([makeChunk("x")]));
      const p = new GenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gemini",
          systemPrompt: "",
          withReasoning: true,
        })
      );
      expect(
        generateContentStreamMock.mock.calls[0]?.[0]?.config?.thinkingConfig
          ?.includeThoughts
      ).toBe(true);
    });

    it("attaches tools when provided", async () => {
      generateContentStreamMock.mockResolvedValueOnce(iter([makeChunk("x")]));
      const p = new GenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gemini",
          systemPrompt: "",
          tools: [{ name: "t", description: "d", inputSchema: {} }],
        })
      );
      expect(
        generateContentStreamMock.mock.calls[0]?.[0]?.config?.tools?.[0]
          ?.functionDeclarations?.length
      ).toBe(1);
    });

    it("yields cancelled on abort error", async () => {
      const err = new Error("abort");
      err.name = "AbortError";
      generateContentStreamMock.mockRejectedValueOnce(err);
      const p = new GenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "gemini",
          systemPrompt: "",
        })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("cancelled");
    });

    it("yields error on other exceptions", async () => {
      generateContentStreamMock.mockRejectedValueOnce(new Error("boom"));
      const p = new GenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const frames = await drain(
        p.sendMessage({ messages: [], model: "gemini", systemPrompt: "" })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("error");
    });
  });

  describe("sendMessageSync", () => {
    it("returns the response text", async () => {
      generateContentMock.mockResolvedValueOnce({ text: "answer" });
      const p = new GenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "gemini",
          systemPrompt: "",
        })
      ).toBe("answer");
    });

    it("rethrows on error", async () => {
      generateContentMock.mockRejectedValueOnce(new Error("x"));
      const p = new GenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await expect(
        p.sendMessageSync({
          messages: [],
          model: "gemini",
          systemPrompt: "",
        })
      ).rejects.toThrow("x");
    });
  });

  describe("static checkProvider", () => {
    it("returns true on success", async () => {
      modelsListMock.mockResolvedValueOnce({
        get page() {
          return Promise.resolve([]);
        },
        hasNextPage: () => false,
      });
      await expect(
        GenAIProvider.checkProvider({
          baseUrl: "https://x",
          apiKey: "sk",
        })
      ).resolves.toBe(true);
    });

    it("returns emptyKey when no apiKey provided", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("no"));
      const out = await GenAIProvider.checkProvider({ baseUrl: "https://x" });
      expect(out).toEqual({ field: "key", message: "Empty key" });
    });

    it("maps empty-object error to invalidUrl", async () => {
      modelsListMock.mockRejectedValueOnce({});
      const out = await GenAIProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });

    it("maps plain Error objects to invalidUrl (empty-object branch)", async () => {
      // Error instances have no enumerable own keys, so they hit the
      // `isEmptyObject` branch before any message inspection.
      modelsListMock.mockRejectedValueOnce(new Error("anything"));
      const out = await GenAIProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });

    it("maps structured 'API key' errors to invalidKey", async () => {
      modelsListMock.mockRejectedValueOnce(
        Object.assign({ code: 401 }, { message: "API key invalid" })
      );
      const out = await GenAIProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "key", message: "Invalid API key" });
    });

    it("falls through to invalidKey on generic structured errors with a key", async () => {
      modelsListMock.mockRejectedValueOnce({ code: 500, message: "mystery" });
      const out = await GenAIProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "key", message: "Invalid API key" });
    });
  });

  describe("static getProviderModels", () => {
    it("delegates to listModels", async () => {
      modelsListMock.mockResolvedValueOnce({
        get page() {
          return Promise.resolve([{ name: "models/x" }]);
        },
        hasNextPage: () => false,
      });
      const out = await GenAIProvider.getProviderModels({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out[0].id).toBe("x");
    });
  });
});
