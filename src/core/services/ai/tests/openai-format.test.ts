import { describe, expect, it } from "vitest";
import {
  type OpenAIChatCompletionChunk,
  type OpenAIStreamChunk,
  type OpenAIStreamError,
  toOpenAIChatCompletionStream,
} from "../openai-format";
import type { ChatEvent } from "../types";

async function* feed(events: ChatEvent[]) {
  for (const e of events) yield e;
}

async function collect(events: ChatEvent[]): Promise<OpenAIStreamChunk[]> {
  const out: OpenAIStreamChunk[] = [];
  for await (const chunk of toOpenAIChatCompletionStream(feed(events), {
    model: "gpt-test",
    created: 1700000000,
  })) {
    out.push(chunk);
  }
  return out;
}

/** Narrow to chat-completion chunks for the success-path assertions. */
async function collectChunks(
  events: ChatEvent[]
): Promise<OpenAIChatCompletionChunk[]> {
  return (await collect(events)) as OpenAIChatCompletionChunk[];
}

describe("toOpenAIChatCompletionStream", () => {
  it("emits role + incremental text deltas and a terminal stop chunk", async () => {
    const chunks = await collectChunks([
      {
        type: "user-message-stored",
        message: { role: "user", content: "hi" },
        messageId: "u1",
      },
      {
        type: "message-start",
        messageId: "m1",
        message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
      },
      {
        type: "message-delta",
        messageId: "m1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      },
      {
        type: "message-end",
        messageId: "m1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      },
    ]);

    expect(chunks.every((c) => c.object === "chat.completion.chunk")).toBe(true);
    expect(chunks.every((c) => c.id === "chatcmpl-m1")).toBe(true);
    expect(chunks.every((c) => c.model === "gpt-test")).toBe(true);

    // start: role + first text; delta: only the appended slice; end: stop.
    expect(chunks[0].choices[0].delta).toEqual({
      role: "assistant",
      content: "Hel",
    });
    expect(chunks[1].choices[0].delta).toEqual({ content: "lo world" });
    expect(chunks[2].choices[0]).toEqual({
      index: 0,
      delta: {},
      finish_reason: "stop",
    });
  });

  it("encodes a pending tool call as delta.tool_calls + finish_reason tool_calls", async () => {
    const chunks = await collectChunks([
      {
        type: "tool-call-pending",
        messageId: "m2",
        threadId: "t1",
        idx: 0,
        autoAllow: false,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "search",
              args: { q: "x" },
              argsText: '{"q":"x"}',
            },
          ],
        },
      },
    ]);

    const last = chunks[chunks.length - 1];
    expect(last.choices[0].finish_reason).toBe("tool_calls");
    expect(last.choices[0].delta.tool_calls).toEqual([
      {
        index: 0,
        id: "call_1",
        type: "function",
        function: { name: "search", arguments: '{"q":"x"}' },
      },
    ]);
  });

  it("maps an incomplete length status to finish_reason length", async () => {
    const chunks = await collectChunks([
      {
        type: "message-incomplete",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "partial" }],
          status: { type: "incomplete", reason: "length" },
        },
      } as ChatEvent,
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].finish_reason).toBe("length");
  });

  it("emits an OpenAI error envelope when the provider errored", async () => {
    const chunks = await collect([
      {
        type: "message-incomplete",
        message: {
          role: "assistant",
          content: "",
          status: {
            type: "incomplete",
            reason: "error",
            error: { code: "rate_limit", message: "Slow down" },
          },
        },
      } as ChatEvent,
    ]);

    expect(chunks).toHaveLength(1);
    const err = chunks[0] as OpenAIStreamError;
    expect("choices" in err).toBe(false);
    expect(err.error).toEqual({
      message: "Slow down",
      type: "rate_limit_error",
      code: "rate_limit",
      param: null,
    });
  });

  it("falls back to server_error for an unknown error code", async () => {
    const chunks = await collect([
      {
        type: "message-incomplete",
        message: {
          role: "assistant",
          content: "",
          status: { type: "incomplete", reason: "error" },
        },
      } as ChatEvent,
    ]);

    const err = chunks[0] as OpenAIStreamError;
    expect(err.error.type).toBe("server_error");
    expect(err.error.message).toBe("The request failed");
  });
});
