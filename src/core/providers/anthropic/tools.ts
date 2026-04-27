import type { ToolUnion } from "@anthropic-ai/sdk/resources/index.mjs";
import type { TMCPItem } from "../../../shared/mcp-item";

/**
 * Convert MCP tool descriptors into Anthropic's `ToolUnion` shape.
 *
 * Anthropic requires `input_schema.type: "object"` at the top level, so
 * we wrap the MCP schema even if it already declares `type`. Fields in
 * `tool.inputSchema` override the wrapper when a conflict occurs.
 *
 * @param tools - Tool descriptors from the MCP layer.
 * @returns Tools in the Anthropic `ToolUnion` shape.
 */
export const convertTools = (tools: TMCPItem[]): ToolUnion[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      ...tool.inputSchema,
    },
  }));
