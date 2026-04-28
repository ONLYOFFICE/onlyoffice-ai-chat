import { describe, expect, it } from "vitest";
import {
  createClient,
  createEndResult,
  createErrorResult,
  createInitialResponse,
  getLastToolCall,
} from "../helpers";
import type { ThreadMessageLike } from "@assistant-ui/react";

describe("anthropic helpers", () => {
  it("createClient instantiates with apiKey/baseURL", () => {
    const client = createClient("k", "https://x");
    expect(client).toBeDefined();
  });

  it("createEndResult wraps the response message", () => {
    const message = {
      role: "assistant",
      content: "ok",
    } as ThreadMessageLike;
    expect(createEndResult(message)).toEqual({
      isEnd: true,
      responseMessage: message,
    });
  });

  it("createErrorResult emits an incomplete message with the error", () => {
    const err = new Error("boom");
    const result = createErrorResult(err);
    expect(result.isEnd).toBe(true);
    expect(result.responseMessage.status).toEqual({
      type: "incomplete",
      reason: "error",
      error: err,
    });
  });

  it("createInitialResponse clones the previous message after a tool call", () => {
    const prev = {
      role: "assistant",
      content: [{ type: "text", text: "hi" }],
    } as ThreadMessageLike;
    const result = createInitialResponse(true, prev);
    expect(result).toEqual(prev);
    expect(result).not.toBe(prev);
  });

  it("createInitialResponse returns an empty assistant when no after-tool message", () => {
    expect(createInitialResponse(false, undefined)).toEqual({
      role: "assistant",
      content: [],
    });
  });

  it("getLastToolCall returns null for string content", () => {
    expect(
      getLastToolCall({ role: "assistant", content: "hi" } as ThreadMessageLike)
    ).toBeNull();
  });

  it("getLastToolCall returns null when no tool-calls present", () => {
    expect(
      getLastToolCall({
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
      } as ThreadMessageLike)
    ).toBeNull();
  });

  it("getLastToolCall returns the last tool-call when multiple", () => {
    const last = { type: "tool-call", toolCallId: "b", toolName: "x" };
    const result = getLastToolCall({
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "a", toolName: "x" },
        { type: "text", text: "hi" },
        last,
      ],
    } as ThreadMessageLike);
    expect(result).toEqual(last);
  });
});
