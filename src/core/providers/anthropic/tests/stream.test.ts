import type Anthropic from "@anthropic-ai/sdk";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  createEmptyResponse,
  createErrorResponse,
  createStopResponse,
  handleContentBlockDelta,
  handleContentBlockStart,
  handleMessageStart,
  processStream,
} from "../stream";

const makeEvent = <T extends object>(ev: T) => ev as unknown as never;

async function* iter<T>(items: T[]) {
  for (const it of items) yield it;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("anthropic/stream/response factories", () => {
  it("createEmptyResponse seeds a fresh shell", () => {
    expect(createEmptyResponse()).toEqual({ role: "assistant", content: [] });
  });
  it("createErrorResponse carries the error", () => {
    const err = new Error("x");
    const out = createErrorResponse(err) as {
      status: { reason: string; error: unknown };
    };
    expect(out.status.reason).toBe("error");
    expect(out.status.error).toBe(err);
  });
  it("createStopResponse uses `cancelled`", () => {
    const out = createStopResponse() as { status: { reason: string } };
    expect(out.status.reason).toBe("cancelled");
  });
});

describe("anthropic/stream/handleMessageStart", () => {
  it("resets the response with the event's role", () => {
    const out = handleMessageStart({
      type: "message_start",
      message: { role: "assistant" },
    } as unknown as Anthropic.Messages.RawMessageStartEvent);
    expect(out).toEqual({ role: "assistant", content: [] });
  });
});

describe("anthropic/stream/handleContentBlockStart", () => {
  const base: ThreadMessageLike = { role: "assistant", content: [] };

  it("pushes a text block", () => {
    const out = handleContentBlockStart(
      makeEvent({
        type: "content_block_start",
        content_block: { type: "text", text: "hi" },
      }),
      base
    );
    expect(out.content).toEqual([{ type: "text", text: "hi" }]);
  });

  it("pushes a tool_use block as a tool-call part", () => {
    const out = handleContentBlockStart(
      makeEvent({
        type: "content_block_start",
        content_block: { type: "tool_use", id: "t1", name: "search" },
      }),
      base
    );
    const part = (out.content as unknown as Array<{ type: string; toolCallId: string }>)[0];
    expect(part.type).toBe("tool-call");
    expect(part.toolCallId).toBe("t1");
  });

  it("pushes a thinking block as a reasoning part", () => {
    const out = handleContentBlockStart(
      makeEvent({
        type: "content_block_start",
        content_block: { type: "thinking", thinking: "hmm" },
      }),
      base
    );
    expect(out.content).toEqual([{ type: "reasoning", text: "hmm" }]);
  });

  it("auto-closes a stray <think> text block before starting the next block", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "<think>hmm" }],
    };
    const out = handleContentBlockStart(
      makeEvent({
        type: "content_block_start",
        content_block: { type: "text", text: "next" },
      }),
      seed
    );
    const first = (out.content as unknown as Array<{ text: string }>)[0];
    expect(first.text).toContain("</think>");
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "s" };
    const out = handleContentBlockStart(
      makeEvent({
        type: "content_block_start",
        content_block: { type: "text", text: "x" },
      }),
      seed
    );
    expect(out.content).toBe("s");
  });
});

describe("anthropic/stream/handleContentBlockDelta", () => {
  it("extends a text part with a text_delta", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "a" }],
    };
    const out = handleContentBlockDelta(
      makeEvent({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "b" },
      }),
      seed
    );
    expect(out.content).toEqual([{ type: "text", text: "ab" }]);
  });

  it("appends an input_json_delta onto the in-progress tool-call", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "t",
          toolName: "n",
          args: {},
          argsText: "",
        },
      ],
    };
    const out = handleContentBlockDelta(
      makeEvent({
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: '{"q":"x"}' },
      }),
      seed
    );
    const part = (out.content as unknown as Array<{ argsText: string; args: Record<string, unknown> }>)[0];
    expect(part.argsText).toBe('{"q":"x"}');
    expect(part.args).toEqual({ q: "x" });
  });

  it("keeps args empty until JSON is complete", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "t",
          toolName: "n",
          args: {},
          argsText: "",
        },
      ],
    };
    const out = handleContentBlockDelta(
      makeEvent({
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: '{"q":' },
      }),
      seed
    );
    const part = (out.content as unknown as Array<{ args: Record<string, unknown> }>)[0];
    expect(part.args).toEqual({});
  });

  it("extends a thinking block with a thinking_delta", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "a" }],
    };
    const out = handleContentBlockDelta(
      makeEvent({
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: "b" },
      }),
      seed
    );
    expect(out.content).toEqual([{ type: "reasoning", text: "ab" }]);
  });

  it("stashes a signature_delta onto parentId of the reasoning part", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "reasoning", text: "a" }],
    };
    const out = handleContentBlockDelta(
      makeEvent({
        type: "content_block_delta",
        delta: { type: "signature_delta", signature: "sig" },
      }),
      seed
    );
    const part = (out.content as unknown as Array<{ parentId?: string }>)[0];
    expect(part.parentId).toBe("sig");
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "s" };
    const out = handleContentBlockDelta(
      makeEvent({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "x" },
      }),
      seed
    );
    expect(out.content).toBe("s");
  });
});

describe("anthropic/stream/processStream", () => {
  it("yields snapshots and a terminal isEnd on message_stop", async () => {
    const out = await drain(
      processStream(
        iter([
          makeEvent({
            type: "message_start",
            message: { role: "assistant" },
          }),
          makeEvent({
            type: "content_block_start",
            content_block: { type: "text", text: "hi" },
          }),
          makeEvent({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "!" },
          }),
          makeEvent({ type: "message_stop" }),
        ])
      )
    );
    const last = out[out.length - 1] as {
      isEnd: true;
      responseMessage: ThreadMessageLike;
    };
    expect(last.isEnd).toBe(true);
    expect(last.responseMessage.content).toEqual([
      { type: "text", text: "hi!" },
    ]);
  });

  it("ignores unknown event types", async () => {
    const out = await drain(
      processStream(
        iter([
          makeEvent({ type: "ping" as unknown as "message_start" }),
          makeEvent({ type: "message_stop" }),
        ])
      )
    );
    const last = out[out.length - 1] as { isEnd: true };
    expect(last.isEnd).toBe(true);
  });
});
