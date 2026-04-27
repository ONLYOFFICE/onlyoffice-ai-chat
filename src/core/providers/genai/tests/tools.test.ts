import { describe, expect, it } from "vitest";
import { convertTools } from "../tools";

describe("genai/tools/convertTools", () => {
  it("returns an empty array for no tools", () => {
    expect(convertTools([])).toEqual([]);
  });

  it("wraps MCP tools in FunctionDeclaration shape with uppercase OBJECT", () => {
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
        parameters: {
          type: "OBJECT",
          properties: { q: { type: "string" } },
        },
      },
    ]);
  });
});
