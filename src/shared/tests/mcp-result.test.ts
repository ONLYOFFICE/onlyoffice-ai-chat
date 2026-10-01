import { describe, expect, it } from "vitest";
import {
  IMAGE_ATTACHED_TEXT,
  isMcpImageBlock,
  mcpImageToDataUrl,
  parseMcpEnvelope,
  serializeMcpToolResult,
  splitToolResultImages,
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

describe("isMcpImageBlock", () => {
  it("accepts inline and persisted image blocks", () => {
    expect(isMcpImageBlock({ type: "image", data: "AAA" })).toBe(true);
    expect(isMcpImageBlock({ type: "image", ref: "att-1" })).toBe(true);
  });

  it("rejects text blocks and images without a payload", () => {
    expect(isMcpImageBlock({ type: "text", text: "x" })).toBe(false);
    expect(isMcpImageBlock({ type: "image" })).toBe(false);
    expect(isMcpImageBlock(null)).toBe(false);
  });
});

describe("mcpImageToDataUrl", () => {
  it("builds a data URL from raw base64 and mimeType", () => {
    expect(
      mcpImageToDataUrl({ type: "image", data: "AAA", mimeType: "image/jpeg" })
    ).toBe("data:image/jpeg;base64,AAA");
  });

  it("defaults the mime type to image/png and keeps a data URL as is", () => {
    expect(mcpImageToDataUrl({ type: "image", data: "AAA" })).toBe(
      "data:image/png;base64,AAA"
    );
    expect(
      mcpImageToDataUrl({ type: "image", data: "data:image/gif;base64,Q" })
    ).toBe("data:image/gif;base64,Q");
  });

  it("returns null without inline data", () => {
    expect(mcpImageToDataUrl({ type: "image", ref: "att-1" })).toBeNull();
    expect(mcpImageToDataUrl({ type: "image", data: "" })).toBeNull();
  });
});

describe("parseMcpEnvelope", () => {
  it("parses a serialised envelope that mentions an image", () => {
    const env = parseMcpEnvelope(
      JSON.stringify({ content: [{ type: "image", data: "A" }] })
    );
    expect(env?.content).toHaveLength(1);
  });

  it("skips strings that cannot hold an image block", () => {
    expect(parseMcpEnvelope('{"content":[{"type":"text","text":"x"}]}')).toBe(
      null
    );
    expect(parseMcpEnvelope("plain text")).toBeNull();
    expect(parseMcpEnvelope('{"data":{"base64":"A"}}')).toBeNull();
    expect(parseMcpEnvelope('{"image": broken')).toBeNull();
  });

  it("accepts an already-parsed object and rejects non-envelopes", () => {
    expect(parseMcpEnvelope({ content: [] })).toEqual({ content: [] });
    expect(parseMcpEnvelope({ data: {} })).toBeNull();
    expect(parseMcpEnvelope([1])).toBeNull();
  });
});

describe("splitToolResultImages", () => {
  it("returns a result without images unchanged", () => {
    const text = '{"content":[{"type":"text","text":"hello"}]}';
    expect(splitToolResultImages(text)).toEqual({ text, images: [] });
    expect(splitToolResultImages("plain")).toEqual({
      text: "plain",
      images: [],
    });
  });

  it("swaps inline image blocks for placeholders and returns the images", () => {
    const { text, images } = splitToolResultImages(
      JSON.stringify({
        content: [
          { type: "text", text: "shot" },
          { type: "image", data: "AAA", mimeType: "image/jpeg" },
          { type: "image", data: "BBB" },
        ],
        isError: false,
      })
    );
    expect(JSON.parse(text)).toEqual({
      content: [
        { type: "text", text: "shot" },
        { type: "text", text: IMAGE_ATTACHED_TEXT },
        { type: "text", text: IMAGE_ATTACHED_TEXT },
      ],
      isError: false,
    });
    expect(images).toEqual([
      { dataUrl: "data:image/jpeg;base64,AAA", mimeType: "image/jpeg" },
      { dataUrl: "data:image/png;base64,BBB", mimeType: "image/png" },
    ]);
  });

  it("leaves unhydrated ref blocks in place", () => {
    const text = JSON.stringify({
      content: [{ type: "image", ref: "att-1", mimeType: "image/png" }],
    });
    expect(splitToolResultImages(text)).toEqual({ text, images: [] });
  });
});
