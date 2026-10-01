import { describe, expect, it } from "vitest";
import type { TMCPItem } from "../mcp-item";
import { augmentToolWithIntent, readPartialToolIntent } from "../tool-intent";

describe("augmentToolWithIntent", () => {
  it("lists the intent first so models emit it before the real arguments", () => {
    const tool = {
      name: "save",
      inputSchema: {
        type: "object",
        properties: { body: { type: "string" } },
        required: ["body"],
      },
    } as unknown as TMCPItem;
    const schema = augmentToolWithIntent(tool).inputSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(schema.properties)).toEqual(["aiChatIntent", "body"]);
    expect(schema.required).toEqual(["aiChatIntent", "body"]);
  });
});

describe("readPartialToolIntent", () => {
  it("reads a closed intent out of truncated JSON", () => {
    expect(
      readPartialToolIntent('{"aiChatIntent": "Saving \\"a\\"", "body": "lo')
    ).toBe('Saving "a"');
  });

  it("waits for the closing quote", () => {
    expect(readPartialToolIntent('{"aiChatIntent":"Savi')).toBeUndefined();
    expect(readPartialToolIntent('{"aiChatIntent":"Ends \\')).toBeUndefined();
  });

  it("ignores an empty intent", () => {
    expect(readPartialToolIntent('{"aiChatIntent":"  "')).toBeUndefined();
  });
});
