import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import {
  convertMessagesToResponses,
  convertToolsToResponses,
} from "../responses-messages";

describe("openai/responses-messages/convertMessagesToResponses", () => {
  describe("user role", () => {
    it("passes a plain-string content through", () => {
      const out = convertMessagesToResponses([
        { role: "user", content: "hello" },
      ]);
      expect(out).toEqual([{ role: "user", content: "hello" }]);
    });

    it("maps text parts into input_text content parts", () => {
      const out = convertMessagesToResponses([
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ]);
      expect(out).toEqual([
        { role: "user", content: [{ type: "input_text", text: "hi" }] },
      ]);
    });

    it("serialises file parts into an input_text wrapper", () => {
      const out = convertMessagesToResponses([
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

    it("maps image parts into input_image", () => {
      const out = convertMessagesToResponses([
        {
          role: "user",
          content: [
            { type: "image", image: "data:image/png;base64,AAA" },
          ],
        } as ThreadMessageLike,
      ]);
      const part = (out[0] as { content: Array<unknown> }).content[0];
      expect(part).toEqual({
        type: "input_image",
        image_url: "data:image/png;base64,AAA",
        detail: "auto",
      });
    });
  });

  describe("system role", () => {
    it("keeps system role when downgradeSystem is false", () => {
      const out = convertMessagesToResponses([
        { role: "system", content: "you are nice" },
      ]);
      expect(out).toEqual([{ role: "system", content: "you are nice" }]);
    });

    it("downgrades to user when requested", () => {
      const out = convertMessagesToResponses(
        [{ role: "system", content: "rule" }],
        true
      );
      expect(out).toEqual([{ role: "user", content: "rule" }]);
    });
  });

  describe("assistant role", () => {
    it("string content goes through as a single assistant message", () => {
      const out = convertMessagesToResponses([
        { role: "assistant", content: "answer" },
      ]);
      expect(out).toEqual([{ role: "assistant", content: "answer" }]);
    });

    it("drops empty assistant string content", () => {
      const out = convertMessagesToResponses([
        { role: "assistant", content: "" },
      ]);
      expect(out).toEqual([]);
    });

    it("splits text + tool-call into assistant message + function_call + function_call_output", () => {
      const out = convertMessagesToResponses([
        {
          role: "assistant",
          content: [
            { type: "text", text: "calling tool" },
            {
              type: "tool-call",
              toolCallId: "call-1",
              toolName: "echo",
              argsText: '{"x":1}',
              args: { x: 1 },
              result: "done",
            },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out).toEqual([
        { role: "assistant", content: "calling tool" },
        {
          type: "function_call",
          call_id: "call-1",
          name: "echo",
          arguments: '{"x":1}',
        },
        {
          type: "function_call_output",
          call_id: "call-1",
          output: "done",
        },
      ]);
    });

    it("stringifies non-string tool results", () => {
      const out = convertMessagesToResponses([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "c1",
              toolName: "echo",
              argsText: "{}",
              args: {},
              result: { ok: true },
            },
          ],
        } as ThreadMessageLike,
      ]);
      const output = (out[1] as { output: string }).output;
      expect(JSON.parse(output)).toEqual({ ok: true });
    });

    it("emits function_call without function_call_output when result is missing", () => {
      const out = convertMessagesToResponses([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "pending",
              toolName: "echo",
              argsText: "{}",
              args: {},
            },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out).toEqual([
        {
          type: "function_call",
          call_id: "pending",
          name: "echo",
          arguments: "{}",
        },
      ]);
    });

    it("drops reasoning parts from history", () => {
      const out = convertMessagesToResponses([
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "thinking..." },
            { type: "text", text: "done" },
          ],
        } as ThreadMessageLike,
      ]);
      expect(out).toEqual([{ role: "assistant", content: "done" }]);
    });
  });

  it("preserves multi-turn order across user/assistant/tool exchanges", () => {
    const out = convertMessagesToResponses([
      { role: "user", content: "go" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "ack" },
          {
            type: "tool-call",
            toolCallId: "x",
            toolName: "t",
            argsText: "{}",
            args: {},
            result: "r",
          },
        ],
      } as ThreadMessageLike,
      { role: "user", content: "next" },
    ]);

    expect(out.map((i) => ("role" in i ? i.role : i.type))).toEqual([
      "user",
      "assistant",
      "function_call",
      "function_call_output",
      "user",
    ]);
  });
});

describe("openai/responses-messages/convertToolsToResponses", () => {
  it("produces flat FunctionTool entries without function: wrapping", () => {
    const out = convertToolsToResponses([
      {
        name: "echo",
        description: "echo text",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    expect(out).toEqual([
      {
        type: "function",
        name: "echo",
        description: "echo text",
        parameters: { type: "object", properties: {} },
        strict: false,
      },
    ]);
  });

  it("returns an empty array when no tools are provided", () => {
    expect(convertToolsToResponses([])).toEqual([]);
  });
});
