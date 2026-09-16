import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../messages";

type WireAssistant = {
  role: string;
  content: unknown;
  reasoning_content?: string;
  tool_calls?: Array<{ id: string }>;
  tool_call_id?: string;
};

const toolCall = (id: string, result?: string) => ({
  type: "tool-call" as const,
  toolCallId: id,
  toolName: `tool_${id}`,
  argsText: "{}",
  args: {},
  ...(result === undefined ? {} : { result }),
});

/**
 * A stored assistant message the engine built over a tool loop: each
 * resume appends the next round onto the same message.
 */
const threeRounds = {
  role: "assistant",
  content: [
    { type: "reasoning", text: "R1", parentId: "reasoning-1-a" },
    toolCall("c1", "r1"),
    { type: "reasoning", text: "R2", parentId: "reasoning-2-b" },
    { type: "text", text: "Now the formulas." },
    toolCall("c2", "r2"),
    { type: "reasoning", text: "R3", parentId: "reasoning-3-c" },
    { type: "text", text: "Done." },
  ],
} as ThreadMessageLike;

describe("openai/messages/convertMessages — tool-call rounds", () => {
  it("emits one assistant message per round, each with its own reasoning and tool results", () => {
    const out = convertMessages([threeRounds]) as WireAssistant[];

    expect(out.map((m) => m.role)).toEqual([
      "assistant",
      "tool",
      "assistant",
      "tool",
      "assistant",
    ]);

    expect(out[0]).toEqual({
      role: "assistant",
      content: "",
      reasoning_content: "R1",
      tool_calls: [
        {
          id: "c1",
          type: "function",
          function: { name: "tool_c1", arguments: "{}" },
        },
      ],
    });
    expect(out[1]).toEqual({ role: "tool", content: "r1", tool_call_id: "c1" });

    expect(out[2]).toMatchObject({
      content: "Now the formulas.",
      reasoning_content: "R2",
      tool_calls: [{ id: "c2" }],
    });
    expect(out[3]).toEqual({ role: "tool", content: "r2", tool_call_id: "c2" });

    // The closing text was written after the last tool result, so it is
    // the last message — not folded into the first round's body.
    expect(out[4]).toEqual({
      role: "assistant",
      content: "Done.",
      reasoning_content: "R3",
    });
  });

  it("keeps consecutive tool calls in one round (parallel calls)", () => {
    const out = convertMessages([
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "R" },
          toolCall("a", "ra"),
          toolCall("b", "rb"),
          { type: "text", text: "both done" },
        ],
      } as ThreadMessageLike,
    ]) as WireAssistant[];

    expect(out.map((m) => m.role)).toEqual([
      "assistant",
      "tool",
      "tool",
      "assistant",
    ]);
    expect(out[0].tool_calls?.map((t) => t.id)).toEqual(["a", "b"]);
    expect(out[0].reasoning_content).toBe("R");
    expect(out[3]).toEqual({ role: "assistant", content: "both done" });
  });

  it("leaves a single-round message in the flat shape it always had", () => {
    const out = convertMessages([
      {
        role: "assistant",
        content: [
          { type: "text", text: "hello" },
          { type: "reasoning", text: "thinking..." },
          toolCall("t1", "ok"),
        ],
      } as ThreadMessageLike,
    ]) as WireAssistant[];

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      content: "hello",
      reasoning_content: "thinking...",
      tool_calls: [{ id: "t1" }],
    });
    expect(out[1].tool_call_id).toBe("t1");
  });

  describe("reasoningContent mode", () => {
    const noReasoning: ThreadMessageLike[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "plain string" },
      {
        role: "assistant",
        content: [{ type: "text", text: "parts" }],
      } as ThreadMessageLike,
      {
        role: "assistant",
        content: [toolCall("c", "r"), { type: "text", text: "after" }],
      } as ThreadMessageLike,
    ];

    it("omits reasoning_content when there is none, by default", () => {
      const out = convertMessages(noReasoning) as WireAssistant[];
      for (const m of out) {
        expect("reasoning_content" in m).toBe(false);
      }
    });

    it('stamps an empty reasoning_content on every assistant message with "always"', () => {
      const out = convertMessages(noReasoning, {
        reasoningContent: "always",
      }) as WireAssistant[];

      const assistants = out.filter((m) => m.role === "assistant");
      expect(assistants).toHaveLength(4);
      for (const m of assistants) {
        expect(m.reasoning_content).toBe("");
      }
      // Never on user or tool messages.
      for (const m of out.filter((m) => m.role !== "assistant")) {
        expect("reasoning_content" in m).toBe(false);
      }
    });

    it('keeps the real reasoning where a round has one under "always"', () => {
      const out = convertMessages([threeRounds], {
        reasoningContent: "always",
      }) as WireAssistant[];
      expect(
        out
          .filter((m) => m.role === "assistant")
          .map((m) => m.reasoning_content)
      ).toEqual(["R1", "R2", "R3"]);
    });

    it("still accepts the legacy boolean downgradeSystem argument", () => {
      const out = convertMessages([{ role: "system", content: "s" }], true);
      expect(out[0].role).toBe("user");
    });
  });
});
