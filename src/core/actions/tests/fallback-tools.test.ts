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

  it("closes the assistant turn at a resolved call so the follow-up text comes after the result", () => {
    const merged = {
      role: "assistant",
      content: [
        { type: "text", text: "Let me search." },
        {
          type: "tool-call",
          toolName: "search",
          toolCallId: "1",
          args: { q: "x" },
          result: "found 3",
        },
        { type: "text", text: "Here are the results." },
      ],
    } as unknown as ThreadMessageLike;

    const out = transformHistoryToText([merged]);
    expect(out.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
    expect(out[0].content).toBe(
      'Let me search.\n<TOOL_CALL>{"name":"search","arguments":{"q":"x"}}</TOOL_CALL>'
    );
    expect(out[1].content).toBe("<TOOL_RESULT>found 3</TOOL_RESULT>");
    expect(out[2].content).toBe("Here are the results.");
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

  it("forwards a terminal error status untouched", async () => {
    const errorEnd: SendMessageResult = {
      isEnd: true,
      responseMessage: {
        role: "assistant",
        content: "",
        status: { type: "incomplete", reason: "error", error: { m: "boom" } },
      } as ThreadMessageLike,
    };
    const out = await collect(wrapStream(fakeStream(errorEnd)));
    const last = out[out.length - 1];
    expect("isEnd" in last).toBe(true);
    const msg = "isEnd" in last ? last.responseMessage : last;
    expect(msg.status).toEqual({
      type: "incomplete",
      reason: "error",
      error: { m: "boom" },
    });
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

  it("exposes the running call with its intent before the close tag", async () => {
    const out = await collect(
      wrapStream(
        fakeStream(
          text('hi <TOOL_CALL>{"name":"save"'),
          text(
            'hi <TOOL_CALL>{"name":"save","arguments":{"aiChatIntent":"Saving","body":"lor'
          )
        )
      )
    );
    const [first, second] = out.map((r) =>
      partsOf("isEnd" in r ? r.responseMessage : r).find(
        (p) => p.type === "tool-call"
      )
    );
    expect(first?.toolName).toBe("save");
    expect(first?.args).toEqual({});
    expect(second?.args).toEqual({ aiChatIntent: "Saving" });
    expect(lastTextOf(out)).toBe("hi ");
    expect(out.some((r) => "isEnd" in r)).toBe(false);
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

  it("matches the tags case-insensitively", async () => {
    const out = await collect(
      wrapStream(
        fakeStream(
          textEnd('ok <tool_call>{"name":"a","arguments":{"x":1}}</Tool_Call>')
        )
      )
    );
    const parts = partsOf(lastMessage(out));
    expect(parts.find((p) => p.type === "tool-call")?.args).toEqual({ x: 1 });
    expect(parts.find((p) => p.type === "text")?.text).toBe("ok ");
  });

  it("strips a markdown fence the model wrapped the block in", async () => {
    const out = await collect(
      wrapStream(
        fakeStream(
          textEnd(
            'Searching.\n```json\n<TOOL_CALL>{"name":"a","arguments":{}}</TOOL_CALL>\n```'
          )
        )
      )
    );
    const parts = partsOf(lastMessage(out));
    expect(parts.find((p) => p.type === "tool-call")?.toolName).toBe("a");
    expect(parts.find((p) => p.type === "text")?.text).toBe("Searching.");
  });

  it("carries reasoning parts through untouched", async () => {
    const withReasoning = (t: string, isEnd: boolean): SendMessageResult => {
      const message = {
        role: "assistant",
        content: [
          { type: "reasoning", text: "hmm" },
          { type: "text", text: t },
        ],
      } as unknown as ThreadMessageLike;
      return isEnd ? { isEnd: true, responseMessage: message } : message;
    };
    const out = await collect(
      wrapStream(
        fakeStream(
          withReasoning("plain answer", false),
          withReasoning(
            'plain <TOOL_CALL>{"name":"a","arguments":{}}</TOOL_CALL>',
            true
          )
        )
      )
    );
    for (const yielded of out) {
      const parts = partsOf(
        "isEnd" in yielded ? yielded.responseMessage : yielded
      );
      expect(parts[0]).toEqual({ type: "reasoning", text: "hmm" });
    }
    const finalParts = partsOf(lastMessage(out));
    expect(finalParts.map((p) => p.type)).toEqual([
      "reasoning",
      "text",
      "tool-call",
    ]);
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

// ---------------------------------------------------------------------------
// Interaction with the inline-reasoning splitter (local backends)
// ---------------------------------------------------------------------------

describe("fallback text protocol vs inline reasoning", () => {
  /**
   * The splitter runs inside `provider.sendMessage`, i.e. upstream of
   * `wrapStream`. By the time the fallback protocol reads the message, the
   * thinking is already a `reasoning` part — so it must not reach either the
   * prose or the tool arguments (Bug 83793).
   */
  it("ignores reasoning parts when scanning for a tool call", async () => {
    const upstream = (async function* (): AsyncGenerator<SendMessageResult> {
      yield {
        role: "assistant",
        content: [
          { type: "reasoning", text: "We need a paragraph about coffee." },
          {
            type: "text",
            text: '<TOOL_CALL>{"name":"generate_document","arguments":{"content":"Coffee is warm."}}</TOOL_CALL>',
          },
        ],
      } as ThreadMessageLike;
      yield {
        isEnd: true,
        responseMessage: {
          role: "assistant",
          content: [
            { type: "reasoning", text: "We need a paragraph about coffee." },
            {
              type: "text",
              text: '<TOOL_CALL>{"name":"generate_document","arguments":{"content":"Coffee is warm."}}</TOOL_CALL>',
            },
          ],
        } as ThreadMessageLike,
      };
    })();

    const results: SendMessageResult[] = [];
    for await (const r of wrapStream(upstream)) results.push(r);

    const last = results[results.length - 1] as {
      responseMessage: ThreadMessageLike;
    };
    const parts = last.responseMessage.content as AnyPart[];
    const call = parts.find((p) => p.type === "tool-call");

    expect(call?.toolName).toBe("generate_document");
    expect(call?.args).toEqual({ content: "Coffee is warm." });
    // The deliberation must not have been folded into the document content.
    expect(JSON.stringify(call?.args)).not.toContain("We need a paragraph");
  });
});
