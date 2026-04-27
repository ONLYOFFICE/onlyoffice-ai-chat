import type { ThreadMessageLike } from "@assistant-ui/react";
import type { CompletionEvent } from "@mistralai/mistralai/models/components";
import { describe, expect, it } from "vitest";
import {
  createEmptyResponse,
  createErrorResponse,
  createStopResponse,
  getChoiceFromEvent,
  handleTextContent,
  handleToolCall,
  processStream,
} from "../stream";

const makeEvent = (
  delta: Record<string, unknown>,
  finishReason?: string
): CompletionEvent =>
  ({
    data: {
      choices: [
        {
          index: 0,
          delta,
          finishReason: finishReason ?? null,
        },
      ],
    },
  }) as unknown as CompletionEvent;

async function* iter<T>(items: T[]) {
  for (const it of items) yield it;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

const emptyMsg = (): ThreadMessageLike => createEmptyResponse();

describe("mistral/stream/response factories", () => {
  it("createEmptyResponse seeds fresh shell", () => {
    expect(createEmptyResponse()).toEqual({ role: "assistant", content: [] });
  });
  it("createErrorResponse writes error into text part", () => {
    const msg = createErrorResponse(new Error("boom"));
    expect((msg.content as unknown as Array<{ text: string }>)[0]?.text).toContain(
      "boom"
    );
  });
  it("createStopResponse marks cancelled", () => {
    expect(
      (createStopResponse() as { status: { reason: string } }).status.reason
    ).toBe("cancelled");
  });
});

describe("mistral/stream/handleTextContent", () => {
  it("creates the first text part when empty", () => {
    const out = handleTextContent(
      { content: "hi" } as unknown as never,
      emptyMsg()
    );
    expect(out.content).toEqual([{ type: "text", text: "hi" }]);
  });

  it("appends onto the last text part", () => {
    const seed: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "a" }],
    };
    const out = handleTextContent(
      { content: "b" } as unknown as never,
      seed
    );
    expect(out.content).toEqual([{ type: "text", text: "ab" }]);
  });

  it("is a no-op for missing / non-string content", () => {
    const seed = emptyMsg();
    expect(
      handleTextContent({ content: undefined } as unknown as never, seed)
    ).toBe(seed);
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "s" };
    expect(
      handleTextContent({ content: "x" } as unknown as never, seed)
    ).toBe(seed);
  });
});

describe("mistral/stream/handleToolCall", () => {
  it("appends a tool-call part with parsed args", () => {
    const out = handleToolCall(
      {
        toolCalls: [
          { id: "t1", function: { name: "search", arguments: '{"q":"x"}' } },
        ],
      } as unknown as never,
      emptyMsg()
    );
    const part = (out.content as unknown as Array<{ toolName: string; args: Record<string, unknown> }>)[0];
    expect(part.toolName).toBe("search");
    expect(part.args).toEqual({ q: "x" });
  });

  it("is a no-op when there are no toolCalls", () => {
    const seed = emptyMsg();
    expect(
      handleToolCall({ toolCalls: [] } as unknown as never, seed)
    ).toBe(seed);
  });

  it("is a no-op when content is a string", () => {
    const seed: ThreadMessageLike = { role: "assistant", content: "s" };
    expect(
      handleToolCall(
        {
          toolCalls: [
            { id: "t", function: { name: "n", arguments: "{}" } },
          ],
        } as unknown as never,
        seed
      )
    ).toBe(seed);
  });
});

describe("mistral/stream/getChoiceFromEvent", () => {
  it("pulls the first choice", () => {
    const ev = makeEvent({ content: "x" });
    expect(getChoiceFromEvent(ev)?.delta?.content).toBe("x");
  });

  it("returns undefined when there are no choices", () => {
    expect(
      getChoiceFromEvent({ data: { choices: [] } } as unknown as CompletionEvent)
    ).toBeUndefined();
  });
});

describe("mistral/stream/processStream", () => {
  it("yields snapshots and isEnd on finishReason", async () => {
    const out = await drain(
      processStream(
        iter([
          makeEvent({ content: "hi" }),
          makeEvent({}, "stop"),
        ])
      )
    );
    const last = out[out.length - 1] as {
      isEnd: true;
      responseMessage: ThreadMessageLike;
    };
    expect(last.isEnd).toBe(true);
    expect(last.responseMessage.content).toEqual([{ type: "text", text: "hi" }]);
  });

  it("yields cancelled when signal fires", async () => {
    const ac = new AbortController();
    ac.abort();
    const out = await drain(
      processStream(iter([makeEvent({ content: "hi" })]), ac.signal)
    );
    const last = out[out.length - 1] as {
      responseMessage: { status: { reason: string } };
    };
    expect(last.responseMessage.status.reason).toBe("cancelled");
  });

  it("skips events with no choice", async () => {
    const noChoice = {
      data: { choices: [] },
    } as unknown as CompletionEvent;
    const out = await drain(
      processStream(iter([noChoice, makeEvent({ content: "x" }, "stop")]))
    );
    const last = out[out.length - 1] as { isEnd: true };
    expect(last.isEnd).toBe(true);
  });
});
