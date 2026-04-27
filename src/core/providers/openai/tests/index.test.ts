import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFinishChunk,
  createMockStream,
  createTextDeltaChunk,
} from "../../tests/test-utils";
import { openaiInfo } from "../info";
import { OpenAIProvider } from "../index";

const { chatCreateMock, modelsListMock, imagesGenerateMock } = vi.hoisted(
  () => ({
    chatCreateMock: vi.fn(),
    modelsListMock: vi.fn(),
    imagesGenerateMock: vi.fn(),
  })
);

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreateMock } };
    models = { list: modelsListMock };
    images = { generate: imagesGenerateMock };
  },
}));

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe("OpenAIProvider", () => {
  beforeEach(() => {
    chatCreateMock.mockReset();
    modelsListMock.mockReset();
    imagesGenerateMock.mockReset();
  });

  describe("static identity", () => {
    it("returns the canonical name", () => {
      expect(OpenAIProvider.getName()).toBe(openaiInfo.name);
    });
    it("returns the canonical baseUrl", () => {
      expect(OpenAIProvider.getBaseUrl()).toBe(openaiInfo.baseUrl);
    });
  });

  describe("constructor", () => {
    it("creates an instance with valid credentials", () => {
      const p = new OpenAIProvider({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-x",
      });
      expect(p).toBeDefined();
    });
  });

  describe("sendMessage", () => {
    it("streams a text response and yields a final isEnd frame", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createTextDeltaChunk("hi"), createFinishChunk()])
      );

      const p = new OpenAIProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      const frames = await drain(
        p.sendMessage({
          messages: [{ role: "user", content: "Q" }],
          model: "gpt-4o",
          systemPrompt: "be nice",
        })
      );
      const last = frames[frames.length - 1] as {
        isEnd: true;
        responseMessage: ThreadMessageLike;
      };
      expect(last.isEnd).toBe(true);
      expect(last.responseMessage.content).toEqual([
        { type: "text", text: "hi" },
      ]);
    });

    it("yields a cancelled response when the signal aborts", async () => {
      const ac = new AbortController();
      const error = new Error("aborted");
      error.name = "AbortError";
      chatCreateMock.mockRejectedValueOnce(error);

      ac.abort();

      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-4o",
          systemPrompt: "",
          signal: ac.signal,
        })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("cancelled");
    });

    it("yields an error response when the SDK throws", async () => {
      chatCreateMock.mockRejectedValueOnce(new Error("boom"));

      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const frames = await drain(
        p.sendMessage({ messages: [], model: "gpt-4o", systemPrompt: "" })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("error");
    });

    it("passes reasoning_effort when withReasoning is set", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createFinishChunk()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5",
          systemPrompt: "s",
          withReasoning: true,
        })
      );
      expect(chatCreateMock.mock.calls[0]?.[0]?.reasoning_effort).toBe(
        "medium"
      );
    });

    it("attaches tools when any are provided", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createFinishChunk()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-4o",
          systemPrompt: "",
          tools: [{ name: "t", description: "d", inputSchema: {} }],
        })
      );
      expect(chatCreateMock.mock.calls[0]?.[0]?.tools?.length).toBe(1);
    });
  });

  describe("sendMessageSync", () => {
    it("returns the assistant content on success", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const text = await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "gpt-4o",
        systemPrompt: "s",
      });
      expect(text).toBe("answer");
    });

    it("returns an empty string when the SDK throws", async () => {
      chatCreateMock.mockRejectedValueOnce(new Error("fail"));
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const text = await p.sendMessageSync({
        messages: [],
        model: "gpt-4o",
        systemPrompt: "",
      });
      expect(text).toBe("");
    });

    it("returns empty string when the choice has no content", async () => {
      chatCreateMock.mockResolvedValueOnce({ choices: [{ message: {} }] });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "gpt-4o",
          systemPrompt: "",
        })
      ).toBe("");
    });
  });

  describe("imageGeneration", () => {
    it("returns the base64 payload", async () => {
      imagesGenerateMock.mockResolvedValueOnce({
        data: [{ b64_json: "BASE64" }],
      });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const out = await p.imageGeneration({
        model: "dall-e-3",
        prompt: "a cat",
      });
      expect(out).toBe("BASE64");
    });

    it("uses a custom size when width/height are provided", async () => {
      imagesGenerateMock.mockResolvedValueOnce({
        data: [{ b64_json: "BASE64" }],
      });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await p.imageGeneration({
        model: "dall-e-3",
        prompt: "a dog",
        width: 512,
        height: 512,
      });
      expect(imagesGenerateMock.mock.calls[0]?.[0]?.size).toBe("512x512");
    });

    it("falls back to an empty string when no data", async () => {
      imagesGenerateMock.mockResolvedValueOnce({ data: [] });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const out = await p.imageGeneration({
        model: "dall-e-3",
        prompt: "x",
      });
      expect(out).toBe("");
    });
  });

  describe("static checkProvider", () => {
    it("returns true on success", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [] });
      await expect(
        OpenAIProvider.checkProvider({ baseUrl: "https://x", apiKey: "sk" })
      ).resolves.toBe(true);
    });

    it("maps invalid_api_key error to invalidKey", async () => {
      modelsListMock.mockRejectedValueOnce({ code: "invalid_api_key" });
      const out = await OpenAIProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "key", message: "Invalid API key" });
    });

    it("maps a connection error to invalidUrl", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("Connection error."));
      const out = await OpenAIProvider.checkProvider({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(out).toEqual({ field: "url", message: "Invalid URL" });
    });

    it("maps empty key + generic error to emptyKey", async () => {
      modelsListMock.mockRejectedValueOnce(new Error("x"));
      const out = await OpenAIProvider.checkProvider({ baseUrl: "https://x" });
      expect(out).toEqual({ field: "key", message: "Empty key" });
    });
  });

  describe("static getProviderModels", () => {
    it("delegates to listModels", async () => {
      modelsListMock.mockResolvedValueOnce({ data: [{ id: "gpt-4o" }] });
      const models = await OpenAIProvider.getProviderModels({
        baseUrl: "https://x",
        apiKey: "sk",
      });
      expect(models[0]).toMatchObject({ id: "gpt-4o", provider: "openai" });
    });
  });
});
