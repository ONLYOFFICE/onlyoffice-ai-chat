import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../messages";

describe("genai/messages/convertMessages", () => {
  it("wraps string user content into a single text part", () => {
    const out = convertMessages([{ role: "user", content: "hi" }]);
    expect(out).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  });

  it("maps text parts of user content", () => {
    const out = convertMessages([
      {
        role: "user",
        content: [{ type: "text", text: "hi" }],
      } as ThreadMessageLike,
    ]);
    expect(out).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  });

  it("maps image parts into inlineData when the URL is valid", () => {
    const out = convertMessages([
      {
        role: "user",
        content: [{ type: "image", image: "data:image/png;base64,AAA" }],
      } as ThreadMessageLike,
    ]);
    expect(out[0].parts?.[0]).toEqual({
      inlineData: { mimeType: "image/png", data: "AAA" },
    });
  });

  it("skips image parts with malformed data URLs", () => {
    const out = convertMessages([
      {
        role: "user",
        content: [{ type: "image", image: "not-a-data-url" }],
      } as ThreadMessageLike,
    ]);
    expect(out[0].parts).toEqual([]);
  });

  it("folds file parts into a text part with filename prefix", () => {
    const out = convertMessages([
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "DATA",
            mimeType: JSON.stringify({ path: "/tmp/a.txt" }),
          },
        ],
      } as ThreadMessageLike,
    ]);
    expect(out[0].parts?.[0]?.text).toContain("a.txt");
    expect(out[0].parts?.[0]?.text).toContain("DATA");
  });

  it("extracts filename from Windows-style paths", () => {
    const out = convertMessages([
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "D",
            mimeType: JSON.stringify({ path: "C:\\tmp\\a.txt" }),
          },
        ],
      } as ThreadMessageLike,
    ]);
    expect(out[0].parts?.[0]?.text).toContain("a.txt");
  });

  it("downgrades system role to user", () => {
    const out = convertMessages([{ role: "system", content: "s" }]);
    expect(out[0].role).toBe("user");
  });

  it("maps assistant string content to a single model entry", () => {
    const out = convertMessages([{ role: "assistant", content: "ok" }]);
    expect(out).toEqual([{ role: "model", parts: [{ text: "ok" }] }]);
  });

  it("drops empty assistant content", () => {
    const out = convertMessages([{ role: "assistant", content: "" }]);
    expect(out).toEqual([]);
  });

  it("marks reasoning parts with thought:true", () => {
    const out = convertMessages([
      {
        role: "assistant",
        content: [{ type: "reasoning", text: "t" }],
      } as ThreadMessageLike,
    ]);
    expect(out[0].parts?.[0]).toEqual({ text: "t", thought: true });
  });

  it("emits functionCall + functionResponse across two wire entries", () => {
    const out = convertMessages([
      {
        role: "assistant",
        content: [
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
    expect(out[0].role).toBe("model");
    expect(out[1].role).toBe("user");
    expect(out[1].parts?.[0]?.functionResponse).toEqual({
      name: "search",
      response: { result: "ok" },
    });
  });

  it("includes thoughtSignature metadata when present on tool-call parts", () => {
    const out = convertMessages([
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "t",
            toolName: "n",
            args: {},
            argsText: "{}",
            metadata: { thoughtSignature: "sig" },
          } as unknown as never,
        ],
      } as ThreadMessageLike,
    ]);
    expect(
      (out[0].parts?.[0] as { thoughtSignature?: string })?.thoughtSignature
    ).toBe("sig");
  });
});
