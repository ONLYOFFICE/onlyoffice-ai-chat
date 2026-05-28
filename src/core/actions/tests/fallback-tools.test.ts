import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import type { SendMessageResult } from "../../../shared/send-message-args";
import {
  buildToolsBlock,
  isFallbackProfile,
  transformHistoryToText,
  wrapStream,
} from "../chat/fallback-tools";

type AnyPart = {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  argsText?: string;
  args?: Record<string, unknown>;
  result?: unknown;
};

const text = (t: string): SendMessageResult =>
  ({
    role: "assistant",
    content: [{ type: "text", text: t }],
  }) as ThreadMessageLike;

const textEnd = (t: string): SendMessageResult => ({
  isEnd: true,
  responseMessage: {
    role: "assistant",
    content: [{ type: "text", text: t }],
  } as ThreadMessageLike,
});

async function* fakeStream(
  ...results: SendMessageResult[]
): AsyncGenerator<SendMessageResult> {
  for (const r of results) yield r;
}

const collect = async (gen: AsyncGenerator<SendMessageResult>) => {
  const out: SendMessageResult[] = [];
  for await (const r of gen) out.push(r);
  return out;
};

const lastMessage = (results: SendMessageResult[]): ThreadMessageLike => {
  const last = results[results.length - 1];
  return "isEnd" in last ? last.responseMessage : last;
};

const partsOf = (m: ThreadMessageLike): AnyPart[] =>
  Array.isArray(m.content) ? (m.content as AnyPart[]) : [];

const lastTextOf = (results: SendMessageResult[]): string => {
  const parts = partsOf(lastMessage(results));
  const textPart = parts.find((p) => p.type === "text");
  return textPart?.text ?? "";
};

// ---------------------------------------------------------------------------
// buildToolsBlock
// ---------------------------------------------------------------------------

describe("buildToolsBlock", () => {
  it("includes the open/close tags and call format", () => {
    const block = buildToolsBlock([]);
    expect(block).toContain("<TOOL_CALL>");
    expect(block).toContain("</TOOL_CALL>");
    expect(block).toMatch(/"name":"<tool_name>"/);
  });

  it("lists each tool with name, description, schema", () => {
    const block = buildToolsBlock([
      {
        name: "web_search",
        description: "Search the web",
        inputSchema: { type: "object", properties: { q: { type: "string" } } },
      },
    ]);
    expect(block).toContain("Name: web_search");
    expect(block).toContain("Description: Search the web");
    expect(block).toContain('"type": "object"');
    expect(block).toContain('"q"');
  });
});

// ---------------------------------------------------------------------------
// transformHistoryToText
// ---------------------------------------------------------------------------

describe("transformHistoryToText", () => {
  it("passes user and system messages through unchanged", () => {
    const input: ThreadMessageLike[] = [
      { role: "user", content: "hi" },
      { role: "system", content: "be terse" },
    ];
    expect(transformHistoryToText(input)).toEqual(input);
  });

  it("converts assistant tool-call without result to a TOOL_CALL text", () => {
    const input: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "let me check" },
          {
            type: "tool-call",
            toolName: "web_search",
            toolCallId: "id-1",
            argsText: '{"q":"foo"}',
            args: { q: "foo" },
          },
        ],
      } as unknown as ThreadMessageLike,
    ];

    const out = transformHistoryToText(input);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("assistant");
    const content = out[0].content as string;
    expect(typeof content).toBe("string");
    expect(content).toContain("let me check");
    expect(content).toContain(
      '<TOOL_CALL>{"name":"web_search","arguments":{"q":"foo"}}</TOOL_CALL>'
    );
  });

  it("appends a user TOOL_RESULT message when tool-call has result", () => {
    const input: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolName: "echo",
            toolCallId: "id-2",
            argsText: "{}",
            args: {},
            result: '{"ok":true}',
          },
        ],
      } as unknown as ThreadMessageLike,
    ];

    const out = transformHistoryToText(input);
    expect(out).toHaveLength(2);
    expect(out[0].role).toBe("assistant");
    expect(out[1].role).toBe("user");
    expect(out[1].content).toBe('<TOOL_RESULT>{"ok":true}</TOOL_RESULT>');
  });

  it("drops reasoning parts", () => {
    const input: ThreadMessageLike[] = [
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "secret thoughts" },
          { type: "text", text: "answer" },
        ],
      } as unknown as ThreadMessageLike,
    ];
    const out = transformHistoryToText(input);
    expect(out[0].content).toBe("answer");
    expect(out[0].content).not.toContain("secret thoughts");
  });
});

// ---------------------------------------------------------------------------
// isFallbackProfile
// ---------------------------------------------------------------------------

describe("isFallbackProfile", () => {
  const base = {
    providerType: "openai",
    baseUrl: "https://example",
    key: "k",
    modelId: "m",
  } as const;

  it("returns true only for canUseTool === false", () => {
    expect(isFallbackProfile({ ...base, canUseTool: false })).toBe(true);
    expect(isFallbackProfile({ ...base, canUseTool: true })).toBe(false);
    expect(isFallbackProfile({ ...base })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wrapStream — text-protocol parser
// ---------------------------------------------------------------------------

describe("wrapStream", () => {
  it("passes through plain text and emits final on isEnd", async () => {
    const out = await collect(
      wrapStream(
        fakeStream(text("hel"), text("hello world"), textEnd("hello world"))
      )
    );
    expect(lastTextOf(out)).toBe("hello world");
    expect("isEnd" in out[out.length - 1]).toBe(true);
  });

  it("withholds the partial OPEN tag prefix during streaming", async () => {
    // hold tail = OPEN.length - 1 = 10. Feed a long prefix so the leading
    // text falls outside the held window while the partial tag stays in it.
    const intermediate = await collect(
      wrapStream(fakeStream(text("hello world hi <TOOL_CA")))
    );
    expect(lastTextOf(intermediate)).not.toContain("<TOOL");
    expect(lastTextOf(intermediate)).toContain("hello world");
  });

  it("parses a complete TOOL_CALL block in a single chunk", async () => {
    const block =
      '<TOOL_CALL>{"name":"web_search","arguments":{"q":"weather"}}</TOOL_CALL>';
    const out = await collect(
      wrapStream(fakeStream(textEnd(`prelude ${block}`)))
    );
    const parts = partsOf(lastMessage(out));
    const toolPart = parts.find((p) => p.type === "tool-call");
    expect(toolPart).toBeTruthy();
    expect(toolPart?.toolName).toBe("web_search");
    expect(toolPart?.args).toEqual({ q: "weather" });
    const textPart = parts.find((p) => p.type === "text");
    expect(textPart?.text).toBe("prelude ");
  });

  it("handles a TOOL_CALL split across many chunks without leaking the tag", async () => {
    const chunks = [
      "thinking ",
      "thinking <TOOL",
      'thinking <TOOL_CALL>{"name":"echo"',
      'thinking <TOOL_CALL>{"name":"echo","arguments":{"x":1}}',
      'thinking <TOOL_CALL>{"name":"echo","arguments":{"x":1}}</TOOL_CALL>',
    ];
    const stream = fakeStream(
      ...chunks.map((c, i) => (i === chunks.length - 1 ? textEnd(c) : text(c)))
    );
    const out = await collect(wrapStream(stream));

    // No intermediate yield should expose "<TOOL".
    const intermediates = out.slice(0, -1);
    for (const yielded of intermediates) {
      const parts = partsOf(
        "isEnd" in yielded ? yielded.responseMessage : yielded
      );
      const t = parts.find((p) => p.type === "text")?.text ?? "";
      expect(t).not.toContain("<TOOL");
    }

    // Final yield carries text + tool-call.
    const finalParts = partsOf(lastMessage(out));
    const finalTool = finalParts.find((p) => p.type === "tool-call");
    expect(finalTool?.toolName).toBe("echo");
    expect(finalTool?.args).toEqual({ x: 1 });
    const finalText = finalParts.find((p) => p.type === "text")?.text;
    expect(finalText).toBe("thinking ");
  });

  it("falls back to plain text when the JSON inside TOOL_CALL is broken", async () => {
    const out = await collect(
      wrapStream(fakeStream(textEnd("<TOOL_CALL>not json</TOOL_CALL>")))
    );
    const parts = partsOf(lastMessage(out));
    expect(parts.find((p) => p.type === "tool-call")).toBeUndefined();
    expect(parts.find((p) => p.type === "text")?.text).toBe(
      "<TOOL_CALL>not json</TOOL_CALL>"
    );
  });

  it("falls back to plain text when name is missing", async () => {
    const out = await collect(
      wrapStream(
        fakeStream(textEnd('<TOOL_CALL>{"arguments":{"x":1}}</TOOL_CALL>'))
      )
    );
    const parts = partsOf(lastMessage(out));
    expect(parts.find((p) => p.type === "tool-call")).toBeUndefined();
  });

  it("falls back to plain text when the close tag never arrives", async () => {
    const out = await collect(
      wrapStream(fakeStream(textEnd('hi <TOOL_CALL>{"name":"x"'))) //
    );
    const parts = partsOf(lastMessage(out));
    expect(parts.find((p) => p.type === "tool-call")).toBeUndefined();
    expect(parts.find((p) => p.type === "text")?.text).toBe(
      'hi <TOOL_CALL>{"name":"x"'
    );
  });

  it("ignores trailing text after </TOOL_CALL>", async () => {
    const out = await collect(
      wrapStream(
        fakeStream(
          textEnd(
            '<TOOL_CALL>{"name":"a","arguments":{}}</TOOL_CALL> trailing junk'
          )
        )
      )
    );
    const parts = partsOf(lastMessage(out));
    const toolPart = parts.find((p) => p.type === "tool-call");
    expect(toolPart?.toolName).toBe("a");
    const textPart = parts.find((p) => p.type === "text");
    // textBefore is empty, trailing is dropped — no text part with junk.
    expect(textPart?.text ?? "").not.toContain("trailing junk");
  });
});
