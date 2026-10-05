import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { describe, expect, it } from "vitest";
import {
  createFinishChunk,
  createReasoningChunk,
  createTextDeltaChunk,
  createToolCallChunk,
} from "../../tests/test-utils";
import {
  createEmptyResponse,
  createErrorResponse,
  createStopResponse,
  finalizeReasoning,
  handleImages,
  handleReasoning,
  handleText,
  handleToolCall,
  processStream,
  readImageDeltas,
  readReasoningDelta,
} from "../stream";

const emptyMsg = (): ThreadMessageLike => createEmptyResponse();

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

describe("openai/stream/response factories", () => {
  it("createEmptyResponse returns a fresh assistant shell", () => {
    expect(createEmptyResponse()).toEqual({ role: "assistant", content: [] });
  });

  it("createErrorResponse normalizes the Error into a ChatErrorPayload", () => {
    const err = new Error("boom");
    const out = createErrorResponse(err) as unknown as {
      status: { reason: string; error: { code: string; message: string } };
    };
    expect(out.status.reason).toBe("error");
    expect(out.status.error).toEqual({ code: "unknown", message: "boom" });
    // Survives JSON round-trip — the whole point of normalization.
    expect(JSON.parse(JSON.stringify(out.status.error))).toEqual(
      out.status.error
    );
  });

  it("createErrorResponse maps OpenAI 401 to code 'auth'", () => {
    const err = Object.assign(new Error("Incorrect API key"), { status: 401 });
    const out = createErrorResponse(err) as unknown as {
      status: { error: { code: string } };
    };
    expect(out.status.error.code).toBe("auth");
  });

  it("createStopResponse uses `cancelled` as the reason", () => {
    const out = createStopResponse() as { status: { reason: string } };
    expect(out.status.reason).toBe("cancelled");
  });
});

// ---------------------------------------------------------------------------
// Reasoning handlers
// ---------------------------------------------------------------------------

describe("openai/stream/handleReasoning", () => {
  it("starts a new reasoning part when content is empty", () => {
    const out = handleReasoning(emptyMsg(), "hello");
    expect(out.content).toEqual([{ type: "reasoning", text: "hello" }]);
  });

  it("appends onto the last reasoning part", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "a" }],
    };
    const out = handleReasoning(seed, "b");
    expect(out.content).toEqual([{ type: "reasoning", text: "ab" }]);
  });

  it("creates a new reasoning part when the last is not reasoning", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "x" }],
    };
    const out = handleReasoning(seed, "y");
    expect(out.content).toEqual([
      { type: "text", text: "x" },
      { type: "reasoning", text: "y" },
    ]);
  });

  it("is a no-op for empty reasoning content", () => {
    const seed = emptyMsg();
    expect(handleReasoning(seed, "")).toBe(seed);
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "x" };
    expect(handleReasoning(seed, "more")).toBe(seed);
  });
});

describe("openai/stream/finalizeReasoning", () => {
  it("assigns a parentId to unfinalized reasoning parts", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "t" }],
    };
    const out = finalizeReasoning(seed);
    const part = (out.content as unknown as Array<{ parentId?: string }>)[0];
    expect(part.parentId).toBeTruthy();
  });

  it("leaves already-finalized reasoning parts alone", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "t", parentId: "r-1" }],
    };
    const out = finalizeReasoning(seed);
    expect(
      (out.content as unknown as Array<{ parentId: string }>)[0].parentId
    ).toBe("r-1");
  });

  it("appends an empty text part with addEmptyText when last part is reasoning", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "t" }],
    };
    const out = finalizeReasoning(seed, true);
    const parts = out.content as unknown as Array<{
      type: string;
      text?: string;
    }>;
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({ type: "text", text: "" });
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "x" };
    expect(finalizeReasoning(seed)).toBe(seed);
  });
});

// ---------------------------------------------------------------------------
// Text handler
// ---------------------------------------------------------------------------

describe("openai/stream/handleText", () => {
  const chunk = (content: string): ChatCompletionChunk.Choice =>
    ({
      index: 0,
      delta: { content },
      finish_reason: null,
    }) as ChatCompletionChunk.Choice;

  it("appends onto the last text part", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "a" }],
    };
    const out = handleText(seed, chunk("b"));
    expect(out.content).toEqual([{ type: "text", text: "ab" }]);
  });

  it("creates the first text part when content is empty", () => {
    const out = handleText(emptyMsg(), chunk("hi"));
    expect(out.content).toEqual([{ type: "text", text: "hi" }]);
  });

  it("starts a new text part after reasoning", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "r" }],
    };
    const out = handleText(seed, chunk("t"));
    const parts = out.content as unknown as Array<{ type: string }>;
    expect(parts.map((p) => p.type)).toEqual(["reasoning", "text"]);
  });

  it("is a no-op on empty delta content", () => {
    const seed = emptyMsg();
    expect(handleText(seed, chunk(""))).toBe(seed);
  });
});

// ---------------------------------------------------------------------------
// Tool-call handler
// ---------------------------------------------------------------------------

describe("openai/stream/readImageDeltas", () => {
  it("reads every image url in order", () => {
    expect(
      readImageDeltas([
        { image_url: { url: "data:image/png;base64,AAA" } },
        { image_url: { url: "https://cdn.example.com/i.png" } },
      ])
    ).toEqual(["data:image/png;base64,AAA", "https://cdn.example.com/i.png"]);
  });

  it("returns nothing for a missing or malformed field", () => {
    expect(readImageDeltas(undefined)).toEqual([]);
    expect(readImageDeltas("nope")).toEqual([]);
    expect(readImageDeltas([null, 7, {}, { image_url: {} }])).toEqual([]);
    expect(readImageDeltas([{ image_url: { url: "" } }])).toEqual([]);
  });
});

describe("openai/stream/handleImages", () => {
  it("appends one image part per url", () => {
    const out = handleImages(emptyMsg(), ["data:image/png;base64,AAA"]);
    expect(out.content).toEqual([
      { type: "image", image: "data:image/png;base64,AAA" },
    ]);
  });

  it("keeps two images as two separate parts", () => {
    const out = handleImages(emptyMsg(), ["a", "b"]);
    expect(out.content).toEqual([
      { type: "image", image: "a" },
      { type: "image", image: "b" },
    ]);
  });

  it("is a no-op when there are no urls", () => {
    const msg = emptyMsg();
    expect(handleImages(msg, [])).toBe(msg);
  });
});

describe("openai/stream/handleToolCall", () => {
  it("creates a fresh tool-call part when none is in progress", () => {
    const out = handleToolCall(
      emptyMsg(),
      createToolCallChunk("t1", "search", '{"q":"x"}').choices[0]
    );
    const parts = out.content as unknown as Array<{
      type: string;
      toolCallId: string;
    }>;
    expect(parts[0].type).toBe("tool-call");
    expect(parts[0].toolCallId).toBe("t1");
  });

  it("merges fragmented arguments into the existing part", () => {
    let msg = emptyMsg();
    msg = handleToolCall(
      msg,
      createToolCallChunk("t1", "search", '{"q":').choices[0]
    );
    msg = handleToolCall(msg, createToolCallChunk("", "", '"x"}').choices[0]);
    const part = (
      msg.content as unknown as Array<{
        argsText: string;
        args: Record<string, unknown>;
      }>
    )[0];
    expect(part.argsText).toBe('{"q":"x"}');
    expect(part.args).toEqual({ q: "x" });
  });

  it("keeps args empty when JSON is not yet complete", () => {
    const out = handleToolCall(
      emptyMsg(),
      createToolCallChunk("t1", "search", '{"q":').choices[0]
    );
    const part = (
      out.content as unknown as Array<{ args: Record<string, unknown> }>
    )[0];
    expect(part.args).toEqual({});
  });

  it("is a no-op when no tool-call delta is present", () => {
    const seed = emptyMsg();
    const out = handleToolCall(seed, {
      index: 0,
      delta: {},
      finish_reason: null,
    } as ChatCompletionChunk.Choice);
    expect(out).toBe(seed);
  });

  type ToolPart = {
    type: string;
    toolCallId: string;
    toolName: string;
    argsText: string;
    args: Record<string, unknown>;
  };

  const toolChoice = (
    calls: Array<{
      index?: number;
      id?: string;
      name?: string;
      args?: string;
    }>
  ): ChatCompletionChunk.Choice =>
    ({
      index: 0,
      delta: {
        tool_calls: calls.map((c) => ({
          index: c.index,
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.args },
        })),
      },
      finish_reason: null,
    }) as unknown as ChatCompletionChunk.Choice;

  it("keeps two interleaved calls apart by index (Bug 84216)", () => {
    const slots = new Map<number, number>();
    let msg = emptyMsg();
    const feed = (calls: Parameters<typeof toolChoice>[0]): ThreadMessageLike =>
      handleToolCall(msg, toolChoice(calls), slots);
    msg = feed([{ index: 0, id: "c1", name: "search", args: "" }]);
    msg = feed([{ index: 0, args: '{"query":"Vega' }]);
    msg = feed([{ index: 1, id: "c2", name: "search", args: "" }]);
    msg = feed([{ index: 0, args: ' rocket"}' }]);
    msg = feed([{ index: 1, args: '{"query":"Soyuz-2"}' }]);

    const parts = msg.content as unknown as ToolPart[];
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      toolCallId: "c1",
      toolName: "search",
      argsText: '{"query":"Vega rocket"}',
      args: { query: "Vega rocket" },
    });
    expect(parts[1]).toMatchObject({
      toolCallId: "c2",
      toolName: "search",
      argsText: '{"query":"Soyuz-2"}',
      args: { query: "Soyuz-2" },
    });
  });

  it("reads every entry when one delta carries several calls", () => {
    const msg = handleToolCall(
      emptyMsg(),
      toolChoice([
        { index: 0, id: "c1", name: "a", args: "{}" },
        { index: 1, id: "c2", name: "b", args: '{"x":1}' },
      ])
    );
    const parts = msg.content as unknown as ToolPart[];
    expect(parts.map((p) => p.toolCallId)).toEqual(["c1", "c2"]);
    expect(parts[1].args).toEqual({ x: 1 });
  });

  it("opens a new part when a backend reuses index 0 with a new id", () => {
    const slots = new Map<number, number>();
    let msg = emptyMsg();
    msg = handleToolCall(
      msg,
      toolChoice([{ index: 0, id: "c1", name: "a", args: "{}" }]),
      slots
    );
    msg = handleToolCall(
      msg,
      toolChoice([{ index: 0, id: "c2", name: "b", args: "{}" }]),
      slots
    );
    msg = handleToolCall(msg, toolChoice([{ index: 0, args: "" }]), slots);
    const parts = msg.content as unknown as ToolPart[];
    expect(parts.map((p) => p.toolCallId)).toEqual(["c1", "c2"]);
  });

  it("falls back to the last part when the delta has no index", () => {
    let msg = emptyMsg();
    msg = handleToolCall(
      msg,
      toolChoice([{ id: "c1", name: "a", args: '{"q":' }])
    );
    msg = handleToolCall(msg, toolChoice([{ args: '"x"}' }]));
    msg = handleToolCall(
      msg,
      toolChoice([{ id: "c2", name: "b", args: "{}" }])
    );
    const parts = msg.content as unknown as ToolPart[];
    expect(parts.map((p) => p.toolCallId)).toEqual(["c1", "c2"]);
    expect(parts[0].args).toEqual({ q: "x" });
  });
});

// ---------------------------------------------------------------------------
// processStream
// ---------------------------------------------------------------------------

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

async function* toStream(chunks: ChatCompletionChunk[]) {
  for (const c of chunks) yield c;
}

describe("openai/stream/processStream", () => {
  it("yields snapshots then a terminal isEnd on finish", async () => {
    const out = await collect(
      processStream(toStream([createTextDeltaChunk("hi"), createFinishChunk()]))
    );
    const last = out[out.length - 1] as unknown as {
      isEnd: true;
      responseMessage: ThreadMessageLike;
    };
    expect(last.isEnd).toBe(true);
    expect(last.responseMessage.content).toEqual([
      { type: "text", text: "hi" },
    ]);
  });

  it("finalises reasoning when finish arrives mid-thought", async () => {
    const out = await collect(
      processStream(
        toStream([createReasoningChunk("thinking"), createFinishChunk()])
      )
    );
    const last = out[out.length - 1] as unknown as {
      responseMessage: { content: Array<{ parentId?: string }> };
    };
    expect(last.responseMessage.content[0].parentId).toBeTruthy();
  });

  it("emits an image part when the delta carries images", async () => {
    // The Bug: an image-output route (Gemini 3 Pro Image) streams its
    // reasoning and then the picture. Before `images` was read, the round
    // showed the thinking block and nothing else.
    const imageChunk = {
      choices: [
        {
          delta: {
            images: [{ image_url: { url: "data:image/png;base64,AAA" } }],
          },
          index: 0,
        },
      ],
    } as unknown as ChatCompletionChunk;

    const out = await collect(
      processStream(
        toStream([
          createReasoningChunk("planning a carrot"),
          imageChunk,
          createFinishChunk(),
        ])
      )
    );
    const last = out[out.length - 1] as unknown as {
      responseMessage: {
        content: Array<{ type: string; image?: string; parentId?: string }>;
      };
    };
    const content = last.responseMessage.content;

    // Thinking is closed off before the image, so the picture is its own
    // part rather than being swallowed into the reasoning transcript.
    expect(content[0].type).toBe("reasoning");
    expect(content[0].parentId).toBeTruthy();
    expect(content[1]).toEqual({
      type: "image",
      image: "data:image/png;base64,AAA",
    });
  });

  it("finalises reasoning when text starts after thinking", async () => {
    const out = await collect(
      processStream(
        toStream([
          createReasoningChunk("r"),
          createTextDeltaChunk("t"),
          createFinishChunk(),
        ])
      )
    );
    const last = out[out.length - 1] as unknown as {
      responseMessage: { content: Array<{ type: string; parentId?: string }> };
    };
    const reasoning = last.responseMessage.content.find(
      (p) => p.type === "reasoning"
    );
    expect(reasoning?.parentId).toBeTruthy();
  });

  it("finalises reasoning when a tool_call arrives after thinking", async () => {
    const out = await collect(
      processStream(
        toStream([
          createReasoningChunk("r"),
          createToolCallChunk("t1", "search", "{}"),
          createFinishChunk(),
        ])
      )
    );
    const last = out[out.length - 1] as unknown as {
      responseMessage: { content: Array<{ type: string; parentId?: string }> };
    };
    const reasoning = last.responseMessage.content.find(
      (p) => p.type === "reasoning"
    );
    expect(reasoning?.parentId).toBeTruthy();
  });

  it("yields two tool-call parts for two parallel calls (Bug 84216)", async () => {
    const call = (
      index: number,
      id: string | undefined,
      args: string
    ): ChatCompletionChunk =>
      ({
        id: "x",
        object: "chat.completion.chunk",
        created: 0,
        model: "m",
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index,
                  id,
                  type: "function",
                  function: {
                    name: id ? "search" : undefined,
                    arguments: args,
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }) as unknown as ChatCompletionChunk;
    const out = await collect(
      processStream(
        toStream([
          call(0, "c1", '{"query":"Vega'),
          call(1, "c2", '{"query":'),
          call(0, undefined, ' rocket"}'),
          call(1, undefined, '"Soyuz-2"}'),
          createFinishChunk(),
        ])
      )
    );
    const last = out[out.length - 1] as unknown as {
      responseMessage: { content: Array<{ args: unknown }> };
    };
    expect(last.responseMessage.content).toHaveLength(2);
    expect(last.responseMessage.content.map((p) => p.args)).toEqual([
      { query: "Vega rocket" },
      { query: "Soyuz-2" },
    ]);
  });

  it("salvages a partial response when the stream ends without finish_reason", async () => {
    const out = await collect(
      processStream(toStream([createTextDeltaChunk("hi")]))
    );
    const last = out[out.length - 1] as unknown as {
      isEnd: true;
      responseMessage: { content: Array<{ text: string }> };
    };
    expect(last.isEnd).toBe(true);
    expect(last.responseMessage.content[0].text).toBe("hi");
  });

  it("yields an error response when the stream ends empty", async () => {
    const out = await collect(processStream(toStream([])));
    const last = out[out.length - 1] as unknown as {
      isEnd: true;
      responseMessage: { status: { reason: string } };
    };
    expect(last.responseMessage.status.reason).toBe("error");
  });

  it("reports a stream cut after text had arrived as cancelled, not finished (bug 84028)", async () => {
    const ac = new AbortController();
    async function* cut(): AsyncGenerator<ChatCompletionChunk> {
      yield createTextDeltaChunk("Once upon");
      // The consumer hangs up here; the SDK ends the iterator without a
      // finish_reason and without throwing.
      ac.abort();
    }
    const out = await collect(processStream(cut(), ac.signal));
    const last = out[out.length - 1] as unknown as {
      isEnd: true;
      responseMessage: { status?: { reason: string } };
    };
    expect(last.responseMessage.status?.reason).toBe("cancelled");
  });

  it("keeps a reply whose finish_reason arrived before the hang-up", async () => {
    const ac = new AbortController();
    async function* done(): AsyncGenerator<ChatCompletionChunk> {
      yield createTextDeltaChunk("Done.");
      yield createFinishChunk();
      ac.abort();
    }
    const out = await collect(processStream(done(), ac.signal));
    const last = out[out.length - 1] as unknown as {
      isEnd: true;
      responseMessage: { status?: { reason: string } };
    };
    expect(last.responseMessage.status).toBeUndefined();
  });

  it("yields a cancelled (stop) response when ended empty after abort", async () => {
    const ac = new AbortController();
    ac.abort();
    const out = await collect(processStream(toStream([]), ac.signal));
    const last = out[out.length - 1] as unknown as {
      isEnd: true;
      responseMessage: { status: { reason: string } };
    };
    expect(last.responseMessage.status.reason).toBe("cancelled");
  });
});

// ---------------------------------------------------------------------------
// Reasoning delta field
// ---------------------------------------------------------------------------

describe("openai/stream/readReasoningDelta", () => {
  it("reads the OpenRouter-style `reasoning` field", () => {
    expect(readReasoningDelta({ reasoning: "hmm" })).toBe("hmm");
  });

  it("prefers reasoning_content when a backend sends both", () => {
    expect(readReasoningDelta({ reasoning_content: "a", reasoning: "b" })).toBe(
      "a"
    );
  });

  it("ignores a non-string `reasoning` instead of stringifying it", () => {
    expect(
      readReasoningDelta({ reasoning: { effort: "medium" } })
    ).toBeUndefined();
    expect(readReasoningDelta({})).toBeUndefined();
  });

  it("reads OpenRouter's structured reasoning_details", () => {
    expect(
      readReasoningDelta({
        reasoning_details: [
          { type: "reasoning.text", text: "step " },
          { type: "reasoning.text", text: "by step" },
        ],
      })
    ).toBe("step by step");
  });

  it("reads a summarized detail (what OpenRouter returns for Claude)", () => {
    expect(
      readReasoningDelta({
        reasoning_details: [{ type: "reasoning.summary", summary: "gist" }],
      })
    ).toBe("gist");
  });

  it("skips encrypted details and empty arrays", () => {
    expect(
      readReasoningDelta({
        reasoning_details: [{ type: "reasoning.encrypted", data: "opaque" }],
      })
    ).toBeUndefined();
    expect(readReasoningDelta({ reasoning_details: [] })).toBeUndefined();
    expect(
      readReasoningDelta({ reasoning_details: "not-an-array" })
    ).toBeUndefined();
  });

  it("does not double-count when a backend sends text and details", () => {
    expect(
      readReasoningDelta({
        reasoning: "thought",
        reasoning_details: [{ type: "reasoning.text", text: "thought" }],
      })
    ).toBe("thought");
  });

  it("streams a `reasoning`-only delta into a reasoning part", async () => {
    const chunk = {
      ...createReasoningChunk("x"),
      choices: [
        {
          index: 0,
          delta: { reasoning: "thought" },
          finish_reason: null,
        },
      ],
    } as unknown as ChatCompletionChunk;
    const out = await collect(
      processStream(toStream([chunk, createFinishChunk()]))
    );
    const last = out[out.length - 1] as unknown as {
      responseMessage: { content: Array<{ type: string; text: string }> };
    };
    expect(last.responseMessage.content[0]).toMatchObject({
      type: "reasoning",
      text: "thought",
    });
  });
});

// ---------------------------------------------------------------------------
// processStream with inline-reasoning splitting (local backends)
// ---------------------------------------------------------------------------

describe("openai/stream/processStream inline reasoning", () => {
  const finalOf = async (chunks: ChatCompletionChunk[], split: boolean) => {
    const out = await collect(
      processStream(toStream(chunks), undefined, {
        splitInlineReasoning: split,
      })
    );
    return (
      out[out.length - 1] as unknown as {
        isEnd: true;
        responseMessage: ThreadMessageLike;
      }
    ).responseMessage;
  };

  it("keeps a <think> span out of the answer text", async () => {
    const msg = await finalOf(
      [
        createTextDeltaChunk("<think>the user wants coffee</think>"),
        createTextDeltaChunk("Coffee is a brewed drink."),
        createFinishChunk(),
      ],
      true
    );

    const content = msg.content as { type: string; text: string }[];
    const text = content
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    const reasoning = content
      .filter((p) => p.type === "reasoning")
      .map((p) => p.text)
      .join("");

    expect(text).toBe("Coffee is a brewed drink.");
    expect(reasoning).toBe("the user wants coffee");
    expect(text).not.toContain("<think>");
  });

  it("splits gpt-oss harmony channels across chunk boundaries", async () => {
    const msg = await finalOf(
      [
        createTextDeltaChunk("<|channel|>anal"),
        createTextDeltaChunk("ysis<|message|>We need a paragraph."),
        createTextDeltaChunk(
          "<|end|><|channel|>final<|message|>Coffee is warm."
        ),
        createFinishChunk(),
      ],
      true
    );

    const content = msg.content as { type: string; text: string }[];
    const text = content
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    const reasoning = content
      .filter((p) => p.type === "reasoning")
      .map((p) => p.text)
      .join("");

    expect(text).toBe("Coffee is warm.");
    expect(reasoning).toBe("We need a paragraph.");
  });

  it("leaves <think> alone when splitting is off (hosted providers)", async () => {
    const msg = await finalOf(
      [createTextDeltaChunk("<think>literal</think>ok"), createFinishChunk()],
      false
    );

    expect(msg.content).toEqual([
      { type: "text", text: "<think>literal</think>ok" },
    ]);
  });

  it("flushes a withheld partial marker when the stream ends abruptly", async () => {
    const msg = await finalOf([createTextDeltaChunk("answer <th")], true);

    const content = msg.content as { type: string; text: string }[];
    const text = content
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    expect(text).toBe("answer <th");
  });
});
