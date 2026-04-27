import { describe, expect, it } from "vitest";
import { convertTools } from "../tools";

describe("anthropic/tools/convertTools", () => {
  it("returns an empty array for no tools", () => {
    expect(convertTools([])).toEqual([]);
  });

  it("wraps MCP tools in the Anthropic Tool shape", () => {
    const out = convertTools([
      {
        name: "search",
        description: "web search",
        inputSchema: { properties: { q: { type: "string" } } },
      },
    ]);
    expect(out).toEqual([
      {
        name: "search",
        description: "web search",
        input_schema: {
          type: "object",
          properties: { q: { type: "string" } },
        },
      },
    ]);
  });

  it("preserves an explicit top-level type in inputSchema via spread", () => {
    const [out] = convertTools([
      {
        name: "t",
        description: "d",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    expect((out as { input_schema: unknown }).input_schema).toMatchObject({
      type: "object",
      properties: {},
    });
  });
});
