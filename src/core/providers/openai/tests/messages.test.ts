import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../messages";

describe("openai/messages/convertMessages", () => {
  describe("user role", () => {
    it("passes a plain-string content through", () => {
      const out = convertMessages([{ role: "user", content: "hello" }]);
      expect(out).toEqual([{ role: "user", content: "hello" }]);
    });

    it("maps text parts into OpenAI text content parts", () => {
      const out = convertMessages([
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ]);
      expect(out).toEqual([
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ]);
    });

    it("serialises file parts into a text wrapper", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [
            {
              type: "file",
              data: "file-content",
              mimeType: JSON.stringify({ path: "/tmp/a.txt" }),
            },
          ],
        } as ThreadMessageLike,
      ]);
      const first = (out[0] as { content: Array<{ text: string }> }).content[0];
      expect(JSON.parse(first.text)).toEqual({
        file_data: "file-content",
        filename: "/tmp/a.txt",
        file_id: "/tmp/a.txt",
      });
    });

    it("maps image parts into image_url", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [
            { type: "image", image: "data:image/png;base64,AAA" },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out[0].content).toEqual([
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,AAA" },
        },
      ]);
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
  });

  describe("assistant role", () => {
    it("passes a plain-string content as string", () => {
      const out = convertMessages([{ role: "assistant", content: "answer" }]);
      expect(out).toEqual([{ role: "assistant", content: "answer" }]);
    });

    it("flattens text/reasoning/tool-call parts into the wire format", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            { type: "text", text: "hello" },
            { type: "reasoning", text: "thinking..." },
            {
              type: "tool-call",
              toolCallId: "t1",
              toolName: "search",
              argsText: "{}",
              args: {},
              result: "ok",
            },
          ],
        } as ThreadMessageLike,
      ]);

      const assistant = out[0] as {
        role: "assistant";
        content: { type: string; text?: string }[];
        reasoning_content?: string;
        tool_calls?: Array<{ id: string; function: { name: string } }>;
      };
      expect(assistant.role).toBe("assistant");
      expect(assistant.content).toEqual([{ type: "text", text: "hello" }]);
      expect(assistant.reasoning_content).toBe("thinking...");
      expect(assistant.tool_calls?.[0]?.function?.name).toBe("search");

      const toolResult = out[1] as {
        role: "tool";
        content: string;
        tool_call_id: string;
      };
      expect(toolResult.role).toBe("tool");
      expect(toolResult.content).toBe("ok");
      expect(toolResult.tool_call_id).toBe("t1");
    });

    it("falls back to a generated tool-call id when none is provided", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolName: "ping",
              argsText: "{}",
              args: {},
              result: "pong",
            },
          ],
        } as ThreadMessageLike,
      ]);
      const toolResult = out[1] as {
        tool_call_id: string;
      };
      expect(typeof toolResult.tool_call_id).toBe("string");
      expect(toolResult.tool_call_id.length).toBeGreaterThan(0);
    });

    it("omits tool_calls / tool messages when none are present", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [{ type: "text", text: "hi" }],
        } as ThreadMessageLike,
      ]);
      const first = out[0] as { tool_calls?: unknown };
      expect(first.tool_calls).toBeUndefined();
      expect(out).toHaveLength(1);
    });
  });
});
