import { describe, expect, it } from "vitest";
import { convertTools } from "../tools";

describe("mistral/tools/convertTools", () => {
  it("returns an empty array for no tools", () => {
    expect(convertTools([])).toEqual([]);
  });

  it("wraps MCP tools in the function-type envelope", () => {
    expect(
      convertTools([
        {
          name: "search",
          description: "web",
          inputSchema: { type: "object" },
        },
      ])
    ).toEqual([
      {
        type: "function",
        function: {
          name: "search",
          description: "web",
          parameters: { type: "object" },
        },
      },
    ]);
  });
});
