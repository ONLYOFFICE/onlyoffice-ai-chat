import { describe, expect, it } from "vitest";
import {
  serializeMcpToolResult,
  stripStructuredContent,
} from "../mcp-result";

describe("stripStructuredContent", () => {
  it("removes structuredContent and keeps the rest", () => {
    expect(
      stripStructuredContent({
        content: [{ type: "text", text: "{}" }],
        structuredContent: { a: 1 },
        isError: false,
      })
    ).toEqual({ content: [{ type: "text", text: "{}" }], isError: false });
  });

  it("returns non-object and untouched results as is", () => {
    const plain = { content: [] };
    expect(stripStructuredContent(plain)).toBe(plain);
    expect(stripStructuredContent("text")).toBe("text");
    expect(stripStructuredContent(null)).toBeNull();
    expect(stripStructuredContent([1])).toEqual([1]);
  });
});

describe("serializeMcpToolResult", () => {
  it("serialises without structuredContent", () => {
    expect(
      serializeMcpToolResult({ content: [], structuredContent: { a: 1 } })
    ).toBe('{"content":[]}');
  });
});
