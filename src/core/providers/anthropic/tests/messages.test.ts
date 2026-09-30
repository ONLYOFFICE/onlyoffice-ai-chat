import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../messages";

describe("anthropic/messages/convertMessages", () => {
  describe("user role", () => {
    it("passes a plain-string content through", () => {
      expect(convertMessages([{ role: "user", content: "hello" }])).toEqual([
        { role: "user", content: "hello" },
      ]);
    });

    it("maps text parts onto text content blocks", () => {
      const out = convertMessages([
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ]);
      expect(out).toEqual([
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ]);
    });

    it("maps image parts onto anthropic image blocks", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [{ type: "image", image: "data:image/png;base64,AAA" }],
        } as ThreadMessageLike,
      ]);
      const block = (
        out[0].content as Array<{
          type: string;
          source?: { media_type: string };
        }>
      )[0];
      expect(block.type).toBe("image");
      expect(block.source?.media_type).toBe("image/png");
    });

    it("degrades an empty data URL (0-byte file) to inert text", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [{ type: "image", image: "data:image/png;base64," }],
        } as ThreadMessageLike,
      ]);
      const block = (
        out[0].content as Array<{ type: string; text?: string }>
      )[0];
      expect(block.type).toBe("text");
      expect(block.text).toBe("");
    });

    it("coerces unknown mime types to image/jpeg", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [{ type: "image", image: "data:image/weird;base64,AAA" }],
        } as ThreadMessageLike,
      ]);
      const block = (
        out[0].content as Array<{ source: { media_type: string } }>
      )[0];
      expect(block.source.media_type).toBe("image/jpeg");
    });

    it("maps file parts onto document blocks", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [
            {
              type: "file",
              data: "content",
              mimeType: JSON.stringify({ path: "/tmp/a.txt" }),
            },
          ],
        } as ThreadMessageLike,
      ]);
      const block = (
        out[0].content as Array<{ type: string; context?: string }>
      )[0];
      expect(block.type).toBe("document");
      expect(block.context).toBe("/tmp/a.txt");
    });

    it("degrades unknown parts into empty text", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [{ type: "unknown" } as unknown as never],
        } as ThreadMessageLike,
      ]);
      expect(out[0].content).toEqual([{ type: "text", text: "" }]);
    });
  });

  describe("system role", () => {
    it("downgrades system to user role", () => {
      const out = convertMessages([{ role: "system", content: "s" }]);
      expect(out[0].role).toBe("user");
    });

    it("maps array content through text parts", () => {
      const out = convertMessages([
        {
          role: "system",
          content: [{ type: "text", text: "a" }],
        } as ThreadMessageLike,
      ]);
      expect(out[0].content).toEqual([{ type: "text", text: "a" }]);
    });
  });

  describe("assistant role", () => {
    it("passes a plain-string content through", () => {
      const out = convertMessages([{ role: "assistant", content: "hi" }]);
      expect(out).toEqual([{ role: "assistant", content: "hi" }]);
    });

    it("maps text parts into text content blocks", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [{ type: "text", text: "a" }],
        } as ThreadMessageLike,
      ]);
      expect(out[0].content).toEqual([{ type: "text", text: "a" }]);
    });

    it("maps signed reasoning parts into thinking blocks", () => {
      const signature =
        "ErUBCkYIBBgCIkDq2H0h6lJvFqpQ0WgU6Q0mCtb1o8Lz3f9ZpTq4k9XaH2sN7cVbYtRe5uIo3pAsDfGhJkLzXcVbNm";
      const out = convertMessages([
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "t", parentId: signature }],
        } as ThreadMessageLike,
      ]);
      expect(out[0].content).toEqual([
        { type: "thinking", thinking: "t", signature },
      ]);
    });

    it("splits assistant+tool_use+tool_result across two wire messages", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            { type: "text", text: "ok" },
            {
              type: "tool-call",
              toolCallId: "t1",
              toolName: "search",
              args: { q: "x" },
              argsText: "{}",
              result: "ok",
            },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out).toHaveLength(2);
      expect(out[0].role).toBe("assistant");
      expect(out[1].role).toBe("user");
      const toolResult = (
        out[1].content as Array<{ type: string; tool_use_id: string }>
      )[0];
      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.tool_use_id).toBe("t1");
    });

    it("attaches MCP result images as image blocks inside tool_result", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "c1",
              toolName: "screenshot",
              args: {},
              result: JSON.stringify({
                content: [
                  { type: "text", text: "shot" },
                  { type: "image", data: "AAAA", mimeType: "image/jpeg" },
                ],
              }),
            },
          ],
        } as ThreadMessageLike,
      ]);
      const toolResult = (
        out[1].content as Array<{ type: string; content: unknown }>
      )[0];
      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.content).toEqual([
        {
          type: "text",
          text: JSON.stringify({
            content: [
              { type: "text", text: "shot" },
              { type: "text", text: "[image attached]" },
            ],
          }),
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: "AAAA",
          },
        },
      ]);
    });

    it("keeps a text-only tool result as a plain string", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "c1",
              toolName: "echo",
              args: {},
              result: '{"content":[{"type":"text","text":"x"}]}',
            },
          ],
        } as ThreadMessageLike,
      ]);
      const toolResult = (
        out[1].content as Array<{ type: string; content: unknown }>
      )[0];
      expect(toolResult.content).toBe(
        '{"content":[{"type":"text","text":"x"}]}'
      );
    });

    it("emits a tool_use without a tool_result entry when there's no result", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "t1",
              toolName: "search",
              args: {},
              argsText: "{}",
            },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out).toHaveLength(1);
      expect(out[0].role).toBe("assistant");
    });

    it("returns an empty-content assistant message when content array is empty string", () => {
      const out = convertMessages([
        { role: "assistant", content: "" } as ThreadMessageLike,
      ]);
      expect(out[0]).toEqual({ role: "assistant", content: [] });
    });
  });
});
