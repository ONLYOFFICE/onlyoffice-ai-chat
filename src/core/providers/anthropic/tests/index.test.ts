import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { anthropicInfo } from "../info";
import { AnthropicProvider } from "../index";
import type { ReasoningLevel } from "../../../../shared/reasoning-level";

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

    describe("thinking per generation", () => {
      const thinkingFor = async (model: string, withReasoning: boolean) => {
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
            model,
            systemPrompt: "",
            withReasoning,
          })
        );
        return messagesCreateMock.mock.calls.at(-1)?.[0]?.thinking;
      };

      it("uses manual extended thinking on 4.5 and earlier, omitted when off", async () => {
        expect(await thinkingFor("claude-sonnet-4-5-20250929", true)).toEqual({
          type: "enabled",
          budget_tokens: 10000,
        });
        expect(await thinkingFor("claude-sonnet-4-5-20250929", false)).toBe(
          undefined
        );
        expect(await thinkingFor("claude-opus-4-1", true)).toEqual({
          type: "enabled",
          budget_tokens: 10000,
        });
      });

      it("switches to adaptive thinking from 4.6 on", async () => {
        // `enabled` + budget is deprecated on 4.6 and a 400 from 4.7.
        expect(await thinkingFor("claude-sonnet-4-6", true)).toEqual({
          type: "adaptive",
        });
        expect(await thinkingFor("claude-opus-4-7", true)).toEqual({
          type: "adaptive",
        });
        expect(await thinkingFor("claude-sonnet-5", true)).toEqual({
          type: "adaptive",
        });
      });

      it("sends an explicit disabled on adaptive models when off", async () => {
        // Opus 5 and Sonnet 5 think by default — omitting the field would
        // leave them reasoning with the toggle off.
        expect(await thinkingFor("claude-sonnet-5", false)).toEqual({
          type: "disabled",
        });
        expect(await thinkingFor("claude-opus-5", false)).toEqual({
          type: "disabled",
        });
        expect(await thinkingFor("claude-sonnet-4-6", false)).toEqual({
          type: "disabled",
        });
      });

      it("never tries to switch Fable / Mythos, which reject both switches", async () => {
        // Off has no switch there: adaptive thinking at the standard depth.
        expect(await thinkingFor("claude-fable-5-1", false)).toEqual({
          type: "adaptive",
        });
        expect(await thinkingFor("claude-mythos-5-1", false)).toEqual({
          type: "adaptive",
        });
        expect(await thinkingFor("claude-fable-5-1", true)).toEqual({
          type: "adaptive",
        });
      });

      it("never sends disabled to Opus 5.5, which rejects it (bug 84082)", async () => {
        expect(await thinkingFor("claude-opus-5-5", false)).toEqual({
          type: "adaptive",
        });
        expect(await thinkingFor("claude-opus-5-5", true)).toEqual({
          type: "adaptive",
        });
      });
    });

    describe("thinking depth", () => {
      const fieldsFor = async (
        model: string,
        reasoningLevel: ReasoningLevel
      ) => {
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
            model,
            systemPrompt: "",
            reasoningLevel,
          })
        );
        const body = messagesCreateMock.mock.calls.at(-1)?.[0] as Record<
          string,
          unknown
        >;
        return { thinking: body.thinking, output_config: body.output_config };
      };
      const maxTokensFor = async (
        args: { reasoningLevel?: ReasoningLevel; withReasoning?: boolean },
        model = "claude-sonnet-4-5-20250929"
      ) => {
        messagesCreateMock.mockResolvedValueOnce(
          iter([makeEv({ type: "message_stop" })])
        );
        const p = new AnthropicProvider({
          baseUrl: "https://api.anthropic.com",
          apiKey: "sk",
        });
        await drain(
          p.sendMessage({ messages: [], model, systemPrompt: "", ...args })
        );
        return (
          messagesCreateMock.mock.calls.at(-1)?.[0] as { max_tokens: number }
        ).max_tokens;
      };

      it("keys max_tokens on the effective level, not the legacy boolean", async () => {
        expect(await maxTokensFor({ reasoningLevel: "high" })).toBe(32000);
        expect(
          await maxTokensFor({ reasoningLevel: "off", withReasoning: true })
        ).toBe(30000);
        // Fable still thinks with the toggle off, so it keeps the headroom.
        expect(
          await maxTokensFor({ reasoningLevel: "off" }, "claude-fable-5-1")
        ).toBe(32000);
      });

      it("sends output_config.effort alongside adaptive thinking on 4.6+", async () => {
        expect(await fieldsFor("claude-sonnet-4-6", "low")).toEqual({
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
        });
        expect(await fieldsFor("claude-opus-5", "max")).toEqual({
          thinking: { type: "adaptive" },
          output_config: { effort: "max" },
        });
        expect(await fieldsFor("claude-fable-5-1", "high")).toEqual({
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
        });
        // Fable cannot stop: a stored off is the standard depth.
        expect(await fieldsFor("claude-fable-5-1", "off")).toEqual({
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
        });
      });

      it("scales the manual budget on 4.5 and earlier, never sending effort", async () => {
        expect(await fieldsFor("claude-sonnet-4-5-20250929", "low")).toEqual({
          thinking: { type: "enabled", budget_tokens: 4000 },
          output_config: undefined,
        });
        expect(await fieldsFor("claude-opus-4-1", "max")).toEqual({
          thinking: { type: "enabled", budget_tokens: 28000 },
          output_config: undefined,
        });
      });

      it("prefers the level over the legacy boolean when both are set", async () => {
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
            model: "claude-sonnet-5",
            systemPrompt: "",
            withReasoning: true,
            reasoningLevel: "off",
          })
        );
        expect(messagesCreateMock.mock.calls.at(-1)?.[0]?.thinking).toEqual({
          type: "disabled",
        });
      });
    });

    it("raises max_tokens above the plain cap when thinking is enabled", async () => {
      messagesCreateMock.mockResolvedValueOnce(
        iter([makeEv({ type: "message_stop" })])
      );
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
          model: "claude-sonnet-4-5",
          systemPrompt: "",
        })
      );
      await drain(
        p.sendMessage({
          messages: [],
          model: "claude-sonnet-4-5",
          systemPrompt: "",
          withReasoning: true,
        })
      );
      const plain = messagesCreateMock.mock.calls[0]?.[0];
      const thinking = messagesCreateMock.mock.calls[1]?.[0];
      // Thinking consumes max_tokens, so the cap must GROW when it's on
      // and keep the visible reply's headroom above the thinking budget.
      expect(thinking.max_tokens).toBeGreaterThan(plain.max_tokens);
      expect(thinking.max_tokens - thinking.thinking.budget_tokens).toBe(22000);
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

    it("rethrows when SDK throws", async () => {
      messagesCreateMock.mockRejectedValueOnce(new Error("x"));
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      await expect(
        p.sendMessageSync({
          messages: [],
          model: "claude",
          systemPrompt: "",
        })
      ).rejects.toThrow("x");
    });

    it("enables thinking when withReasoning is set", async () => {
      messagesCreateMock.mockResolvedValueOnce({
        content: [{ type: "text", text: "hi" }],
      });
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      await p.sendMessageSync({
        messages: [],
        model: "claude",
        systemPrompt: "",
        withReasoning: true,
      });
      expect(messagesCreateMock.mock.calls[0]?.[0]?.thinking?.type).toBe(
        "enabled"
      );
    });

    it("raises max_tokens above the plain cap when thinking is enabled", async () => {
      messagesCreateMock.mockResolvedValue({
        content: [{ type: "text", text: "hi" }],
      });
      const p = new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk",
      });
      await p.sendMessageSync({
        messages: [],
        model: "claude",
        systemPrompt: "",
      });
      await p.sendMessageSync({
        messages: [],
        model: "claude",
        systemPrompt: "",
        withReasoning: true,
      });
      const plain = messagesCreateMock.mock.calls[0]?.[0];
      const thinking = messagesCreateMock.mock.calls[1]?.[0];
      expect(thinking.max_tokens).toBeGreaterThan(plain.max_tokens);
      expect(
        thinking.max_tokens - thinking.thinking.budget_tokens
      ).toBeGreaterThan(plain.max_tokens);
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
