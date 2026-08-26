import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFinishChunk,
  createMockStream,
  createTextDeltaChunk,
} from "../../tests/test-utils";
import { openaiInfo } from "../info";
import { OpenAIProvider } from "../index";

const {
  chatCreateMock,
  modelsListMock,
  imagesGenerateMock,
  responsesCreateMock,
} = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
  modelsListMock: vi.fn(),
  imagesGenerateMock: vi.fn(),
  responsesCreateMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreateMock } };
    models = { list: modelsListMock };
    images = { generate: imagesGenerateMock };
    responses = { create: responsesCreateMock };
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
    responsesCreateMock.mockReset();
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

    it("sends reasoning_effort=none when off for gpt-5.5 (supports none)", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createFinishChunk()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5.5",
          systemPrompt: "s",
          withReasoning: false,
        })
      );
      expect(chatCreateMock.mock.calls[0]?.[0]?.reasoning_effort).toBe("none");
    });

    it("omits reasoning_effort when off for models without none support", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createFinishChunk()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-4o",
          systemPrompt: "s",
          withReasoning: false,
        })
      );
      expect(
        chatCreateMock.mock.calls[0]?.[0]?.reasoning_effort
      ).toBeUndefined();
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

    it("disables parallel tool calls when tools are provided", async () => {
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
      expect(chatCreateMock.mock.calls[0]?.[0]?.parallel_tool_calls).toBe(
        false
      );
    });

    it("omits parallel_tool_calls when no tools are provided", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createFinishChunk()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({ messages: [], model: "gpt-4o", systemPrompt: "" })
      );
      expect(
        chatCreateMock.mock.calls[0]?.[0]?.parallel_tool_calls
      ).toBeUndefined();
    });
  });

  describe("sendMessage — Responses API path", () => {
    async function* responsesIter(events: unknown[]) {
      for (const e of events) yield e;
    }

    const minimalCompletion = () => ({
      type: "response.completed",
      sequence_number: 1,
      response: {},
    });

    it("routes through client.responses.create when useResponsesApi is true", async () => {
      responsesCreateMock.mockResolvedValueOnce(
        responsesIter([minimalCompletion()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [{ role: "user", content: "Q" }],
          model: "gpt-5.5",
          systemPrompt: "be nice",
          useResponsesApi: true,
        })
      );
      expect(responsesCreateMock).toHaveBeenCalledTimes(1);
      expect(chatCreateMock).not.toHaveBeenCalled();
      const payload = responsesCreateMock.mock.calls[0]?.[0];
      expect(payload.model).toBe("gpt-5.5");
      expect(payload.instructions).toBe("be nice");
      expect(payload.stream).toBe(true);
    });

    it("omits the reasoning summary on the one-shot Responses path", async () => {
      // Only `output_text` is read back here, so summary tokens would be
      // billed and discarded.
      responsesCreateMock.mockResolvedValueOnce({ output_text: "titled" });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "gpt-5.5",
        systemPrompt: "s",
        useResponsesApi: true,
        withReasoning: true,
      });
      expect(responsesCreateMock.mock.calls[0]?.[0]?.reasoning).toEqual({
        effort: "medium",
      });
    });

    it("stays on chat.completions when useResponsesApi is undefined", async () => {
      chatCreateMock.mockResolvedValueOnce(
        createMockStream([createFinishChunk()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-4o",
          systemPrompt: "",
        })
      );
      expect(chatCreateMock).toHaveBeenCalledTimes(1);
      expect(responsesCreateMock).not.toHaveBeenCalled();
    });

    it("maps withReasoning to effort=medium plus a summary request on the Responses payload", async () => {
      responsesCreateMock.mockResolvedValueOnce(
        responsesIter([minimalCompletion()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5.5",
          systemPrompt: "",
          useResponsesApi: true,
          withReasoning: true,
        })
      );
      // `summary` is what makes the thinking transcript observable — the
      // Responses API streams no reasoning text without it.
      expect(responsesCreateMock.mock.calls[0]?.[0]?.reasoning).toEqual({
        effort: "medium",
        summary: "auto",
      });
    });

    it("sends reasoning.effort=none on Responses when off for gpt-5.5", async () => {
      responsesCreateMock.mockResolvedValueOnce(
        responsesIter([minimalCompletion()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5.5",
          systemPrompt: "",
          useResponsesApi: true,
          withReasoning: false,
        })
      );
      expect(responsesCreateMock.mock.calls[0]?.[0]?.reasoning).toEqual({
        effort: "none",
      });
    });

    it("converts tools to flat FunctionTool shape (no function: wrapping)", async () => {
      responsesCreateMock.mockResolvedValueOnce(
        responsesIter([minimalCompletion()])
      );
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5.5",
          systemPrompt: "",
          useResponsesApi: true,
          tools: [{ name: "t", description: "d", inputSchema: {} }],
        })
      );
      const tools = responsesCreateMock.mock.calls[0]?.[0]?.tools;
      expect(tools).toHaveLength(1);
      expect(tools[0]).toMatchObject({ type: "function", name: "t" });
      expect(tools[0]).not.toHaveProperty("function");
      expect(responsesCreateMock.mock.calls[0]?.[0]?.parallel_tool_calls).toBe(
        false
      );
    });

    it("yields cancelled response when signal aborts the Responses call", async () => {
      const ac = new AbortController();
      const error = new Error("aborted");
      error.name = "AbortError";
      responsesCreateMock.mockRejectedValueOnce(error);
      ac.abort();

      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5.5",
          systemPrompt: "",
          useResponsesApi: true,
          signal: ac.signal,
        })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("cancelled");
    });

    it("yields an error response when responses.create throws", async () => {
      responsesCreateMock.mockRejectedValueOnce(new Error("boom"));
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const frames = await drain(
        p.sendMessage({
          messages: [],
          model: "gpt-5.5",
          systemPrompt: "",
          useResponsesApi: true,
        })
      );
      const last = frames[frames.length - 1] as {
        responseMessage: { status: { reason: string } };
      };
      expect(last.responseMessage.status.reason).toBe("error");
    });
  });

  describe("checkResponsesApi", () => {
    it("returns true when responses.create succeeds", async () => {
      responsesCreateMock.mockResolvedValueOnce({ id: "r-1" });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await expect(p.checkResponsesApi("gpt-5.5")).resolves.toBe(true);
      expect(responsesCreateMock.mock.calls[0]?.[0]?.stream).toBe(false);
    });

    it("returns false when responses.create rejects", async () => {
      responsesCreateMock.mockRejectedValueOnce(new Error("404"));
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await expect(p.checkResponsesApi("nope")).resolves.toBe(false);
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

    it("rethrows when the SDK throws", async () => {
      chatCreateMock.mockRejectedValueOnce(new Error("fail"));
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await expect(
        p.sendMessageSync({
          messages: [],
          model: "gpt-4o",
          systemPrompt: "",
        })
      ).rejects.toThrow("fail");
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

    it("routes through responses.create when useResponsesApi is true", async () => {
      responsesCreateMock.mockResolvedValueOnce({ output_text: "titled" });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      const text = await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "gpt-5.5",
        systemPrompt: "s",
        useResponsesApi: true,
      });
      expect(text).toBe("titled");
      expect(responsesCreateMock).toHaveBeenCalledTimes(1);
      expect(chatCreateMock).not.toHaveBeenCalled();
      const payload = responsesCreateMock.mock.calls[0]?.[0];
      expect(payload?.stream).toBe(false);
      expect(payload?.instructions).toBe("s");
    });

    it("stays on chat.completions when useResponsesApi is undefined", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "gpt-4o",
        systemPrompt: "s",
      });
      expect(chatCreateMock).toHaveBeenCalledTimes(1);
      expect(responsesCreateMock).not.toHaveBeenCalled();
    });

    it("passes reasoning_effort when withReasoning is set", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "gpt-5",
        systemPrompt: "s",
        withReasoning: true,
      });
      expect(chatCreateMock.mock.calls[0]?.[0]?.reasoning_effort).toBe(
        "medium"
      );
    });

    it("maps withReasoning to reasoning.effort on the Responses payload", async () => {
      responsesCreateMock.mockResolvedValueOnce({ output_text: "answer" });
      const p = new OpenAIProvider({ baseUrl: "https://x", apiKey: "sk" });
      await p.sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "gpt-5.5",
        systemPrompt: "s",
        useResponsesApi: true,
        withReasoning: true,
      });
      expect(responsesCreateMock.mock.calls[0]?.[0]?.reasoning?.effort).toBe(
        "medium"
      );
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
