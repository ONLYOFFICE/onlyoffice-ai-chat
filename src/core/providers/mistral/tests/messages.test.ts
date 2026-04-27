import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../messages";

describe("mistral/messages/convertMessages", () => {
  describe("user role", () => {
    it("wraps a plain string content", () => {
      const out = convertMessages([{ role: "user", content: "hi" }]);
      expect(out).toEqual([
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ]);
    });

    it("flattens text/image/file parts into text content", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [
            { type: "text", text: "a" },
            {
              type: "image",
              image: "data:image/png;base64,AAA",
              filename: "x.png",
            },
            { type: "file", data: "DATA", filename: "f.txt" },
          ],
        } as ThreadMessageLike,
      ]);
      const contents = (out[0] as { content: Array<{ type: string; text: string }> }).content;
      expect(contents).toHaveLength(3);
      expect(contents[0].text).toBe("a");
      expect(contents[1].text).toContain("x.png");
      expect(contents[2].text).toContain("f.txt");
    });

    it("flattens file / image attachments into text content", () => {
      const out = convertMessages([
        {
          role: "user",
          content: "hi",
          attachments: [
            { type: "file", name: "a.txt", content: "A" },
            { type: "image", name: "b.png", content: "B" },
          ],
        } as unknown as ThreadMessageLike,
      ]);
      const contents = (out[0] as { content: Array<{ text: string }> }).content;
      expect(contents.map((c) => c.text)).toEqual([
        "File: a.txt: A",
        "Image: b.png: B",
        "hi",
      ]);
    });

    it("appends a trailing tool message when a tool-call carries a result", () => {
      const out = convertMessages([
        {
          role: "user",
          content: [
            {
              type: "tool-call",
              toolCallId: "t1",
              toolName: "search",
              result: "ok",
              args: {},
              argsText: "",
            },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out).toHaveLength(2);
      expect(out[1].role).toBe("tool");
      expect((out[1] as { content: string | null }).content).toBe("ok");
    });
  });

  describe("assistant role", () => {
    it("wraps string content in text part", () => {
      const out = convertMessages([{ role: "assistant", content: "ok" }]);
      expect(out[0]).toEqual({
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
        toolCalls: undefined,
      });
    });

    it("maps reasoning parts into thinking blocks", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "t" }],
        } as ThreadMessageLike,
      ]);
      const content = (out[0] as { content: Array<{ type: string }> }).content;
      expect(content[0].type).toBe("thinking");
    });

    it("maps tool-calls onto the toolCalls field", () => {
      const out = convertMessages([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "t",
              parentId: "p",
              toolName: "search",
              args: { q: "x" },
              argsText: "{}",
            },
          ],
        } as ThreadMessageLike,
      ]);
      const call = (out[0] as { toolCalls?: Array<{ id: string; function: { name: string } }> })
        .toolCalls?.[0];
      expect(call?.id).toBe("p");
      expect(call?.function?.name).toBe("search");
    });
  });
});
