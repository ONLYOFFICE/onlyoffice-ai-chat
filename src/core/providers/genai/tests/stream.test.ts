import type { ThreadMessageLike } from "@assistant-ui/react";
import type { GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import {
  createEmptyResponse,
  createErrorResponse,
  createStopResponse,
  handleFunctionCall,
  handleText,
  handleThought,
  processChunk,
  processStream,
} from "../stream";

const emptyMsg = (): ThreadMessageLike => createEmptyResponse();

async function* iter<T>(items: T[]) {
  for (const it of items) yield it;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

const chunk = (
  part: GenerateContentResponse["candidates"] extends Array<infer C>
    ? C extends { content?: { parts?: Array<infer P> } }
      ? P
      : never
    : never
): GenerateContentResponse =>
  ({
    candidates: [{ content: { parts: [part] } }],
  }) as unknown as GenerateContentResponse;

describe("genai/stream/response factories", () => {
  it("createEmptyResponse seeds a fresh shell", () => {
    expect(createEmptyResponse()).toEqual({ role: "assistant", content: [] });
  });
  it("createErrorResponse carries the error", () => {
    const err = new Error("x");
    const out = createErrorResponse(err) as {
      status: { reason: string; error: unknown };
    };
    expect(out.status.error).toBe(err);
  });
  it("createStopResponse marks cancelled", () => {
    expect((createStopResponse() as { status: { reason: string } }).status.reason).toBe(
      "cancelled"
    );
  });
});

describe("genai/stream/handleThought", () => {
  it("starts a new reasoning part when empty", () => {
    const out = handleThought(emptyMsg(), "think");
    expect(out.content).toEqual([{ type: "reasoning", text: "think" }]);
  });

  it("extends last reasoning part", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "a" }],
    };
    const out = handleThought(seed, "b");
    expect(out.content).toEqual([{ type: "reasoning", text: "ab" }]);
  });

  it("is a no-op for empty text", () => {
    const seed = emptyMsg();
    expect(handleThought(seed, "")).toBe(seed);
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "s" };
    expect(handleThought(seed, "x")).toBe(seed);
  });
});

describe("genai/stream/handleText", () => {
  it("appends onto last text part", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "a" }],
    };
    const out = handleText(seed, "b");
    expect(out.content).toEqual([{ type: "text", text: "ab" }]);
  });

  it("creates first text part when empty", () => {
    const out = handleText(emptyMsg(), "hi");
    expect(out.content).toEqual([{ type: "text", text: "hi" }]);
  });

  it("starts new text after reasoning", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "r" }],
    };
    const out = handleText(seed, "t");
    expect((out.content as unknown as Array<{ type: string }>).map((p) => p.type)).toEqual(
      ["reasoning", "text"]
    );
  });

  it("is a no-op for empty text / string content", () => {
    const seed = emptyMsg();
    expect(handleText(seed, "")).toBe(seed);
    const str: ThreadMessageLike = { role: "assistant", content: "x" };
    expect(handleText(str, "y")).toBe(str);
  });
});

describe("genai/stream/handleFunctionCall", () => {
  it("appends a tool-call part", () => {
    const out = handleFunctionCall(emptyMsg(), {
      name: "search",
      args: { q: "x" },
    });
    const part = (out.content as unknown as Array<{ type: string; toolName: string }>)[0];
    expect(part.type).toBe("tool-call");
    expect(part.toolName).toBe("search");
  });

  it("stashes thoughtSignature in metadata when provided", () => {
    const out = handleFunctionCall(emptyMsg(), {
      name: "search",
      args: {},
      thoughtSignature: "sig",
    });
    const part = (out.content as unknown as Array<{ metadata?: { thoughtSignature?: string } }>)[0];
    expect(part.metadata?.thoughtSignature).toBe("sig");
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "s" };
    const out = handleFunctionCall(seed, { name: "n", args: {} });
    expect(out).toBe(seed);
  });
});

describe("genai/stream/processChunk", () => {
  it("routes thought parts through handleThought", () => {
    const out = processChunk(
      emptyMsg(),
      chunk({ text: "t", thought: true } as never)
    );
    expect((out.content as unknown as Array<{ type: string }>)[0]?.type).toBe("reasoning");
  });

  it("routes plain text through handleText", () => {
    const out = processChunk(emptyMsg(), chunk({ text: "t" } as never));
    expect((out.content as unknown as Array<{ type: string }>)[0]?.type).toBe("text");
  });

  it("routes functionCall through handleFunctionCall", () => {
    const out = processChunk(
      emptyMsg(),
      chunk({
        functionCall: { name: "search", args: {} },
      } as never)
    );
    expect((out.content as unknown as Array<{ type: string }>)[0]?.type).toBe("tool-call");
  });

  it("is a no-op on a chunk with no candidates", () => {
    const out = processChunk(emptyMsg(), {
      candidates: [],
    } as unknown as GenerateContentResponse);
    expect(out).toEqual(emptyMsg());
  });
});

describe("genai/stream/processStream", () => {
  it("yields snapshots and a terminal isEnd on stream end", async () => {
    const out = await drain(
      processStream(
        iter([
          chunk({ text: "hi" } as never),
          chunk({ text: "!" } as never),
        ])
      )
    );
    const last = out[out.length - 1] as {
      isEnd: true;
      responseMessage: ThreadMessageLike;
    };
    expect(last.isEnd).toBe(true);
    expect(last.responseMessage.content).toEqual([{ type: "text", text: "hi!" }]);
  });

  it("yields cancelled when signal fires between chunks", async () => {
    const ac = new AbortController();
    ac.abort();
    const out = await drain(
      processStream(iter([chunk({ text: "hi" } as never)]), ac.signal)
    );
    const last = out[out.length - 1] as {
      responseMessage: { status: { reason: string } };
    };
    expect(last.responseMessage.status.reason).toBe("cancelled");
  });
});
