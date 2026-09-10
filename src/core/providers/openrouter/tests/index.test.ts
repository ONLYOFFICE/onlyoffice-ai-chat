import { beforeEach, describe, expect, it, vi } from "vitest";
import { openrouterInfo } from "../info";
import { OpenRouterProvider } from "../index";
import type {
  ReasoningLevel,
  ReasoningSupport,
} from "../../../../shared/reasoning-level";

const { chatCreateMock, responsesCreateMock } = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
  responsesCreateMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
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

describe("OpenRouterProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    chatCreateMock.mockReset();
    responsesCreateMock.mockReset();
  });

  it("returns canonical name/baseUrl", () => {
    expect(OpenRouterProvider.getName()).toBe(openrouterInfo.name);
    expect(OpenRouterProvider.getBaseUrl()).toBe(openrouterInfo.baseUrl);
  });

  it("delegates checkProvider", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as unknown as Response);
    await expect(
      OpenRouterProvider.checkProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      })
    ).resolves.toBe(true);
  });

  it("delegates getProviderModels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "x/y" }] }),
    } as unknown as Response);
    const out = await OpenRouterProvider.getProviderModels({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk",
    });
    expect(out[0].provider).toBe("openrouter");
  });

  describe("reasoning request fields", () => {
    // OpenRouter reads its own unified `reasoning` object; `reasoning_effort`
    // leaves the Anthropic route with thinking off, which is what made a
    // Sonnet round come back with no thinking block at all.
    const fieldsOf = (model: string, level: ReasoningLevel) => {
      const provider = new OpenRouterProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      });
      return (
        provider as unknown as {
          reasoningRequestFields: (
            model: string,
            level: ReasoningLevel
          ) => Record<string, unknown>;
        }
      ).reasoningRequestFields(model, level);
    };

    it("asks for thinking through the unified `reasoning` object", () => {
      expect(fieldsOf("anthropic/claude-sonnet-4.5", "medium")).toEqual({
        reasoning: { effort: "medium" },
      });
    });

    it("disables thinking explicitly with effort=none when off", () => {
      // Omitting the field is not enough: reasoning-by-default models keep
      // thinking when nothing says otherwise, so "off" has to be spelled out.
      expect(fieldsOf("openai/gpt-5.1", "off")).toEqual({
        reasoning: { effort: "none" },
      });
      expect(fieldsOf("google/gemini-3-pro-preview", "off")).toEqual({
        reasoning: { effort: "none" },
      });
    });

    it("disables thinking with effort=none on the Anthropic route too", () => {
      // OpenRouter turns `none` into Anthropic's `thinking: disabled`.
      expect(fieldsOf("anthropic/claude-sonnet-4.5", "off")).toEqual({
        reasoning: { effort: "none" },
      });
      expect(fieldsOf("anthropic/claude-sonnet-5", "off")).toEqual({
        reasoning: { effort: "none" },
      });
    });

    it("maps every level onto the unified effort scale", () => {
      expect(fieldsOf("openai/gpt-5.2", "low")).toEqual({
        reasoning: { effort: "low" },
      });
      expect(fieldsOf("openai/gpt-5.2", "high")).toEqual({
        reasoning: { effort: "high" },
      });
      // OpenRouter clamps xhigh to what the routed model accepts.
      expect(fieldsOf("anthropic/claude-opus-4.5", "max")).toEqual({
        reasoning: { effort: "xhigh" },
      });
    });

    it("never sends the OpenAI spelling", () => {
      expect(
        fieldsOf("anthropic/claude-sonnet-4.5", "medium")
      ).not.toHaveProperty("reasoning_effort");
    });
  });

  describe("transport", () => {
    // OpenRouter answers `/v1/responses`, so the inherited probe used to
    // route its profiles there — a transport whose `reasoning.effort` has
    // no "none". Everything stays on chat completions instead.
    const provider = () =>
      new OpenRouterProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      });
    const drain = async (gen: AsyncGenerator<unknown>) => {
      for await (const _ of gen) void _;
    };

    it("reports no Responses API without probing the network", async () => {
      await expect(provider().checkResponsesApi()).resolves.toBe(false);
      expect(responsesCreateMock).not.toHaveBeenCalled();
    });

    it("streams through chat completions even for a profile probed onto Responses", async () => {
      chatCreateMock.mockResolvedValueOnce(completedChat());
      await drain(
        provider().sendMessage({
          messages: [],
          model: "openai/gpt-5.2",
          systemPrompt: "",
          useResponsesApi: true,
          withReasoning: false,
        })
      );
      expect(responsesCreateMock).not.toHaveBeenCalled();
      expect(chatCreateMock.mock.calls[0]?.[0]?.reasoning).toEqual({
        effort: "none",
      });
    });

    it("keeps one-shot calls on chat completions too", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "t" } }],
      });
      await provider().sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "openai/gpt-5.2",
        systemPrompt: "s",
        useResponsesApi: true,
        withReasoning: false,
      });
      expect(responsesCreateMock).not.toHaveBeenCalled();
      const payload = chatCreateMock.mock.calls[0]?.[0];
      expect(payload.reasoning).toEqual({ effort: "none" });
      expect(payload).not.toHaveProperty("reasoning_effort");
    });
  });

  describe("imageGeneration", () => {
    function makeProvider(createImpl: (...args: unknown[]) => unknown) {
      const provider = new OpenRouterProvider({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk",
      });
      (
        provider as unknown as {
          client: { chat: { completions: { create: unknown } } };
        }
      ).client = {
        chat: {
          completions: { create: vi.fn(createImpl) },
        },
      };
      return provider;
    }

    it("strips data-URI prefix and returns raw base64", async () => {
      const provider = makeProvider(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                images: [{ image_url: { url: "data:image/png;base64,AAA" } }],
              },
            },
          ],
        })
      );
      const out = await provider.imageGeneration({
        model: "openai/gpt-4o-image",
        prompt: "kitten",
      });
      expect(out).toBe("AAA");
    });

    it("returns the URL as-is when not a data URI", async () => {
      const provider = makeProvider(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "https://cdn.example.com/i.png" } },
                ],
              },
            },
          ],
        })
      );
      const out = await provider.imageGeneration({
        model: "x",
        prompt: "p",
      });
      expect(out).toBe("https://cdn.example.com/i.png");
    });

    it("returns empty string when the response has no images", async () => {
      const provider = makeProvider(() =>
        Promise.resolve({ choices: [{ message: {} }] })
      );
      const out = await provider.imageGeneration({ model: "x", prompt: "p" });
      expect(out).toBe("");
    });

    it("returns empty string when the request is aborted", async () => {
      const controller = new AbortController();
      const provider = makeProvider(() => {
        controller.abort();
        const err = new Error("aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });
      const out = await provider.imageGeneration({
        model: "x",
        prompt: "p",
        signal: controller.signal,
      });
      expect(out).toBe("");
    });

    it("rethrows non-abort errors", async () => {
      const provider = makeProvider(() => Promise.reject(new Error("boom")));
      await expect(
        provider.imageGeneration({ model: "x", prompt: "p" })
      ).rejects.toThrow("boom");
    });
  });
});

describe("OpenRouterProvider with a profile reasoningSupport", () => {
  const fieldsOf = (
    model: string,
    level: ReasoningLevel,
    reasoningSupport?: ReasoningSupport
  ) => {
    const provider = new OpenRouterProvider({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk",
      ...(reasoningSupport ? { reasoningSupport } : {}),
    });
    return (
      provider as unknown as {
        reasoningRequestFields: (
          model: string,
          level: ReasoningLevel
        ) => Record<string, unknown>;
      }
    ).reasoningRequestFields(model, level);
  };

  it("resolves a stored off against the catalogue's record when the host passes one", () => {
    expect(fieldsOf("openai/gpt-6-astra", "off")).toEqual({
      reasoning: { effort: "none" },
    });
    expect(
      fieldsOf("openai/gpt-6-astra", "off", {
        thinks: true,
        canDisable: false,
        depths: ["low", "medium", "high", "max"],
        defaultDepth: "medium",
      })
    ).toEqual({ reasoning: { effort: "medium" } });
  });

  it("falls back to the id table without one", () => {
    expect(fieldsOf("x-ai/grok-4.6", "off")).toEqual({
      reasoning: { effort: "medium" },
    });
  });
});

describe("OpenRouterProvider on a route that rejects reasoning off", () => {
  beforeEach(() => {
    chatCreateMock.mockReset();
  });
  const mandatory400 = {
    status: 400,
    message:
      "400 Reasoning is mandatory for this endpoint and cannot be disabled.",
  };
  const provider = (reasoningSupport?: ReasoningSupport) =>
    new OpenRouterProvider({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk",
      ...(reasoningSupport ? { reasoningSupport } : {}),
    });
  const drain = async (gen: AsyncGenerator<unknown>) => {
    for await (const _ of gen) void _;
  };

  it("retries the stream once at the standard depth", async () => {
    chatCreateMock
      .mockRejectedValueOnce(mandatory400)
      .mockResolvedValueOnce(completedChat());
    await drain(
      provider().sendMessage({
        messages: [],
        model: "deepseek/deepseek-v4-pro",
        systemPrompt: "",
        reasoningLevel: "off",
      })
    );
    expect(chatCreateMock).toHaveBeenCalledTimes(2);
    expect(chatCreateMock.mock.calls[0]?.[0]?.reasoning).toEqual({
      effort: "none",
    });
    expect(chatCreateMock.mock.calls[1]?.[0]?.reasoning).toEqual({
      effort: "medium",
    });
  });

  it("retries the one-shot call at the catalogue's default depth", async () => {
    chatCreateMock
      .mockRejectedValueOnce(mandatory400)
      .mockResolvedValueOnce({ choices: [{ message: { content: "t" } }] });
    const out = await provider({
      thinks: true,
      canDisable: true,
      depths: ["low", "high", "max"],
      defaultDepth: "high",
    }).sendMessageSync({
      messages: [{ role: "user", content: "q" }],
      model: "deepseek/deepseek-v4.1-flash",
      systemPrompt: "s",
      reasoningLevel: "off",
    });
    expect(out).toBe("t");
    expect(chatCreateMock).toHaveBeenCalledTimes(2);
    expect(chatCreateMock.mock.calls[1]?.[0]?.reasoning).toEqual({
      effort: "high",
    });
  });

  it("leaves a round that asked for a depth alone", async () => {
    chatCreateMock.mockRejectedValueOnce(mandatory400);
    await expect(
      provider().sendMessageSync({
        messages: [{ role: "user", content: "q" }],
        model: "deepseek/deepseek-v4-pro",
        systemPrompt: "s",
        reasoningLevel: "high",
      })
    ).rejects.toBe(mandatory400);
    expect(chatCreateMock).toHaveBeenCalledTimes(1);
  });
});
