import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { describe, expect, it } from "vitest";
import { withCacheControl } from "../cache-control";

/** Shorthand for reading the marker off a block-array message. */
const marks = (message: unknown): boolean[] =>
  ((message as { content: { cache_control?: unknown }[] }).content ?? []).map(
    (part) => Boolean(part.cache_control)
  );

const EPHEMERAL = { type: "ephemeral" };

describe("withCacheControl", () => {
  it("marks the leading system message and the final message", () => {
    const out = withCacheControl([
      { role: "system", content: "rules" },
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
    ] as ChatCompletionMessageParam[]);

    expect(out[0]).toEqual({
      role: "system",
      content: [{ type: "text", text: "rules", cache_control: EPHEMERAL }],
    });
    expect(out[1]).toEqual({ role: "user", content: "one" });
    expect(out[2]).toEqual({ role: "assistant", content: "two" });
    expect(marks(out[3])).toEqual([true]);
  });

  it("leaves a trailing tool message untouched and marks the message before it", () => {
    const out = withCacheControl([
      { role: "system", content: "rules" },
      { role: "user", content: "run it" },
      {
        role: "assistant",
        content: "on it",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "t", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_1",
        content: '{"content":[{"type":"text","text":"Lorem ipsum"}]}',
      },
    ] as ChatCompletionMessageParam[]);

    // The wire format allows only a string or `text` blocks here; any other
    // block type is dropped by the gateway and the model sees an empty result.
    expect(out[3]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: '{"content":[{"type":"text","text":"Lorem ipsum"}]}',
    });
    expect(out[2]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "on it", cache_control: EPHEMERAL }],
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "t", arguments: "{}" },
        },
      ],
    });
  });

  it("never retypes a block-shaped tool message", () => {
    const input = [
      {
        role: "tool",
        tool_call_id: "call_1",
        content: [{ type: "text", text: "ok" }],
      },
    ] as ChatCompletionMessageParam[];

    expect(withCacheControl(input)[0]).toEqual(input[0]);
  });

  it("skips several trailing tool messages of a parallel call", () => {
    const out = withCacheControl([
      { role: "user", content: "run both" },
      { role: "tool", tool_call_id: "call_1", content: "a" },
      { role: "tool", tool_call_id: "call_2", content: "b" },
    ] as ChatCompletionMessageParam[]);

    expect(marks(out[0])).toEqual([true]);
    expect(out[1]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: "a",
    });
    expect(out[2]).toEqual({
      role: "tool",
      tool_call_id: "call_2",
      content: "b",
    });
  });

  it("marks only the trailing text block of a multi-part message", () => {
    const out = withCacheControl([
      { role: "system", content: "rules" },
      {
        role: "user",
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      },
    ] as ChatCompletionMessageParam[]);

    expect(marks(out[1])).toEqual([false, true]);
  });

  it("skips a trailing non-text block in favour of the last text block", () => {
    const out = withCacheControl([
      {
        role: "user",
        content: [
          { type: "text", text: "look" },
          { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
        ],
      },
    ] as unknown as ChatCompletionMessageParam[]);

    expect(marks(out[0])).toEqual([true, false]);
  });

  it("leaves a message with no text content untouched", () => {
    const input = [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
        ],
      },
    ] as unknown as ChatCompletionMessageParam[];

    expect(withCacheControl(input)[0]).toEqual(input[0]);
  });

  it("leaves an empty string content untouched", () => {
    const out = withCacheControl([
      { role: "assistant", content: "" },
    ] as ChatCompletionMessageParam[]);

    expect(out[0]).toEqual({ role: "assistant", content: "" });
  });

  it("does not mutate the input array or its messages", () => {
    const input = [
      { role: "system", content: "rules" },
      { role: "user", content: [{ type: "text", text: "hi" }] },
    ] as ChatCompletionMessageParam[];
    const snapshot = JSON.parse(JSON.stringify(input));

    withCacheControl(input);

    expect(input).toEqual(snapshot);
  });

  it("marks a lone system message once", () => {
    const out = withCacheControl([
      { role: "system", content: "rules" },
    ] as ChatCompletionMessageParam[]);

    expect(marks(out[0])).toEqual([true]);
  });

  it("returns an empty list as is", () => {
    expect(withCacheControl([])).toEqual([]);
  });
});
