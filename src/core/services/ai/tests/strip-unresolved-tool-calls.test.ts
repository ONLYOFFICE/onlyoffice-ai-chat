import { describe, expect, it } from "vitest";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { stripUnresolvedToolCalls } from "../stream";

const msg = (role: string, content: unknown): ThreadMessageLike =>
  ({ role, content }) as ThreadMessageLike;

describe("stripUnresolvedToolCalls", () => {
  it("drops a tool-call with no result but keeps sibling text", () => {
    const out = stripUnresolvedToolCalls([
      msg("assistant", [
        { type: "text", text: "Let me check" },
        { type: "tool-call", toolName: "generateDocx", toolCallId: "c1" },
      ]),
    ]);
    expect(out[0].content).toEqual([{ type: "text", text: "Let me check" }]);
  });

  it("leaves the message empty (filterable) when only a dangling tool-call", () => {
    const out = stripUnresolvedToolCalls([
      msg("assistant", [
        { type: "tool-call", toolName: "generateDocx", toolCallId: "c1" },
      ]),
    ]);
    expect(out[0].content).toEqual([]);
  });

  it("keeps resolved tool calls, including a cancelled result", () => {
    const resolved = [
      msg("assistant", [
        { type: "tool-call", toolName: "t", toolCallId: "c1", result: "ok" },
      ]),
      msg("assistant", [
        {
          type: "tool-call",
          toolName: "t",
          toolCallId: "c2",
          result: { cancelled: true },
        },
      ]),
    ];
    expect(stripUnresolvedToolCalls(resolved)).toEqual(resolved);
  });

  it("returns the same message reference when nothing changes", () => {
    const m = msg("assistant", [{ type: "text", text: "hi" }]);
    const out = stripUnresolvedToolCalls([m]);
    expect(out[0]).toBe(m);
  });

  it("ignores user messages and string content", () => {
    const input = [msg("user", "hello"), msg("assistant", "plain text")];
    expect(stripUnresolvedToolCalls(input)).toEqual(input);
  });
});
