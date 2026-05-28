import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import { processResponsesStream } from "../responses-stream";

// ---------------------------------------------------------------------------
// Event factories — minimal valid shapes for the events the processor
// actually inspects. Fields the processor ignores (sequence_number, logprobs)
// are populated with safe defaults so the structural type-check passes.
// ---------------------------------------------------------------------------

let seq = 0;

const textDelta = (delta: string, itemId = "msg-1"): ResponseStreamEvent =>
  ({
    type: "response.output_text.delta",
    delta,
    item_id: itemId,
    content_index: 0,
    output_index: 0,
    logprobs: [],
    sequence_number: ++seq,
  }) as ResponseStreamEvent;

const reasoningDelta = (delta: string, itemId = "rs-1"): ResponseStreamEvent =>
  ({
    type: "response.reasoning_summary_text.delta",
    delta,
    item_id: itemId,
    output_index: 0,
    summary_index: 0,
    sequence_number: ++seq,
  }) as ResponseStreamEvent;

const functionCallAdded = (
  itemId: string,
  callId: string,
  name: string
): ResponseStreamEvent =>
  ({
    type: "response.output_item.added",
    output_index: 0,
    sequence_number: ++seq,
    item: {
      id: itemId,
      type: "function_call",
      call_id: callId,
      name,
      arguments: "",
    },
  }) as ResponseStreamEvent;

const functionCallArgsDelta = (
  itemId: string,
  delta: string
): ResponseStreamEvent =>
  ({
    type: "response.function_call_arguments.delta",
    item_id: itemId,
    delta,
    output_index: 0,
    sequence_number: ++seq,
  }) as ResponseStreamEvent;

const functionCallArgsDone = (
  itemId: string,
  args: string
): ResponseStreamEvent =>
  ({
    type: "response.function_call_arguments.done",
    item_id: itemId,
    arguments: args,
    output_index: 0,
    sequence_number: ++seq,
  }) as ResponseStreamEvent;

const completed = (): ResponseStreamEvent =>
  ({
    type: "response.completed",
    response: {} as never,
    sequence_number: ++seq,
  }) as ResponseStreamEvent;

const errorEvt = (message: string): ResponseStreamEvent =>
  ({
    type: "error",
    code: null,
    message,
    param: null,
    sequence_number: ++seq,
  }) as ResponseStreamEvent;

async function* iter(
  events: ResponseStreamEvent[]
): AsyncGenerator<ResponseStreamEvent> {
  for (const e of events) yield e;
}

async function collect(
  stream: AsyncGenerator<SendMessageResult>
): Promise<SendMessageResult[]> {
  const out: SendMessageResult[] = [];
  for await (const r of stream) out.push(r);
  return out;
}

const lastTerminal = (results: SendMessageResult[]): SendMessageResult => {
  const terminal = results.findIndex(
    (r) => typeof r === "object" && r !== null && "isEnd" in r
  );
  return results[terminal];
};

describe("processResponsesStream", () => {
  it("text-only: aggregates output_text deltas into a single text part", async () => {
    const results = await collect(
      processResponsesStream(
        iter([textDelta("hel"), textDelta("lo"), completed()])
      )
    );
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    expect(final.responseMessage.content).toEqual([
      { type: "text", text: "hello" },
    ]);
  });

  it("reasoning then text: finalizes reasoning before starting the text part", async () => {
    const results = await collect(
      processResponsesStream(
        iter([
          reasoningDelta("think"),
          reasoningDelta("ing"),
          textDelta("done"),
          completed(),
        ])
      )
    );
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    const parts = final.responseMessage.content;
    if (!Array.isArray(parts)) throw new Error("expected array content");

    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe("reasoning");
    expect((parts[0] as { text: string }).text).toBe("thinking");
    // Reasoning is finalized — `parentId` is assigned.
    expect((parts[0] as { parentId?: string }).parentId).toBeTruthy();
    expect(parts[1]).toEqual({ type: "text", text: "done" });
  });

  it("function_call: argument deltas accumulate into one tool-call part", async () => {
    const results = await collect(
      processResponsesStream(
        iter([
          functionCallAdded("item-1", "call-1", "echo"),
          functionCallArgsDelta("item-1", '{"x":'),
          functionCallArgsDelta("item-1", "1}"),
          functionCallArgsDone("item-1", '{"x":1}'),
          completed(),
        ])
      )
    );
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    const parts = final.responseMessage.content;
    if (!Array.isArray(parts)) throw new Error("expected array content");

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "tool-call",
      toolName: "echo",
      toolCallId: "call-1",
      argsText: '{"x":1}',
      args: { x: 1 },
    });
  });

  it("multiple concurrent tool-calls map to distinct parts keyed by item_id", async () => {
    const results = await collect(
      processResponsesStream(
        iter([
          functionCallAdded("a", "call-a", "alpha"),
          functionCallAdded("b", "call-b", "beta"),
          functionCallArgsDelta("a", '{"k":"A"}'),
          functionCallArgsDelta("b", '{"k":"B"}'),
          completed(),
        ])
      )
    );
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    const parts = final.responseMessage.content;
    if (!Array.isArray(parts)) throw new Error("expected array content");

    expect(parts).toHaveLength(2);
    expect((parts[0] as { toolCallId: string }).toolCallId).toBe("call-a");
    expect((parts[0] as { args: unknown }).args).toEqual({ k: "A" });
    expect((parts[1] as { toolCallId: string }).toolCallId).toBe("call-b");
    expect((parts[1] as { args: unknown }).args).toEqual({ k: "B" });
  });

  it("response.error short-circuits with an error response", async () => {
    const results = await collect(
      processResponsesStream(iter([textDelta("hi"), errorEvt("boom")]))
    );
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    const msg = final.responseMessage as {
      status?: { reason?: string; error?: unknown };
    };
    expect(msg.status?.reason).toBe("error");
  });

  it("stream ends without response.completed and with content — surfaces what we have", async () => {
    const results = await collect(
      processResponsesStream(iter([textDelta("partial")]))
    );
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    const parts = final.responseMessage.content;
    if (!Array.isArray(parts)) throw new Error("expected array content");
    expect(parts).toEqual([{ type: "text", text: "partial" }]);
  });

  it("stream ends without response.completed and with no content — surfaces an error", async () => {
    const results = await collect(processResponsesStream(iter([])));
    const final = lastTerminal(results);
    if (!("isEnd" in final)) throw new Error("expected terminal");
    const msg = final.responseMessage as {
      status?: { reason?: string };
    };
    expect(msg.status?.reason).toBe("error");
  });
});
