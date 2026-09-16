import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../messages";
import { isThinkingSignature } from "../signature";

const SIGNATURE =
  "ErUBCkYIBBgCIkDq2H0h6lJvFqpQ0WgU6Q0mCtb1o8Lz3f9ZpTq4k9XaH2sN7cVbYtRe5uIo3pAsDfGhJkLzXcVbNm";

describe("anthropic/signature", () => {
  it("accepts the base64 signature Anthropic streams", () => {
    expect(isThinkingSignature(SIGNATURE)).toBe(true);
  });

  it("rejects the synthetic id the OpenAI stream stamps on reasoning", () => {
    expect(isThinkingSignature("reasoning-1755770000000-k3j9x2a")).toBe(false);
  });

  it("rejects an absent or empty value", () => {
    expect(isThinkingSignature(undefined)).toBe(false);
    expect(isThinkingSignature("")).toBe(false);
  });
});

describe("anthropic/messages — foreign reasoning", () => {
  it("drops reasoning captured from another provider and keeps the visible turn", () => {
    const out = convertMessages([
      { role: "user", content: "analyse" },
      {
        role: "assistant",
        content: [
          {
            type: "reasoning",
            text: "DeepSeek thought",
            parentId: "reasoning-1-a",
          },
          {
            type: "tool-call",
            toolCallId: "c1",
            toolName: "read_sheet",
            argsText: "{}",
            args: {},
            result: "{}",
          },
          { type: "reasoning", text: "more", parentId: "reasoning-2-b" },
          { type: "text", text: "Here you go." },
        ],
      } as ThreadMessageLike,
      { role: "user", content: "thanks, now with Claude" },
    ]);

    const blocks = out.flatMap((m) =>
      Array.isArray(m.content) ? m.content.map((b) => b.type) : [m.content]
    );
    expect(blocks).not.toContain("thinking");
    expect(blocks).toEqual([
      "analyse",
      "tool_use",
      "tool_result",
      "text",
      "thanks, now with Claude",
    ]);
  });

  it("replays Anthropic's own thinking with its signature", () => {
    const out = convertMessages([
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "t", parentId: SIGNATURE },
          { type: "text", text: "a" },
        ],
      } as ThreadMessageLike,
    ]);
    expect(out[0].content).toEqual([
      { type: "thinking", thinking: "t", signature: SIGNATURE },
      { type: "text", text: "a" },
    ]);
  });
});
