import { describe, expect, it } from "vitest";
import { convertTools } from "../tools";

describe("openai/tools/convertTools", () => {
  it("returns an empty array for no tools", () => {
    expect(convertTools([])).toEqual([]);
  });

  it("wraps each MCP tool in a function-type entry", () => {
    const out = convertTools([
      {
        name: "search",
        description: "web search",
        inputSchema: {
          type: "object",
          properties: { q: { type: "string" } },
        },
      },
    ]);
    expect(out).toEqual([
      {
        type: "function",
        function: {
          name: "search",
          description: "web search",
          parameters: {
            type: "object",
            properties: { q: { type: "string" } },
          },
        },
      },
    ]);
  });

  it("clones inputSchema so mutations don't leak", () => {
    const schema = { type: "object" };
    const [out] = convertTools([
      { name: "a", description: "b", inputSchema: schema },
    ]);
    expect(
      (out as { function: { parameters: unknown } }).function.parameters
    ).not.toBe(schema);
  });
});
