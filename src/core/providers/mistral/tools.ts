import type { Tool } from "@mistralai/mistralai/models/components";
import type { TMCPItem } from "../../../shared/mcp-item";

/**
 * Convert MCP tool descriptors into Mistral's function-tool shape.
 *
 * Mistral mirrors the OpenAI `type: "function"` envelope; the MCP
 * input schema is passed through as-is under `parameters`.
 *
 * @param tools - Tool descriptors from the MCP layer.
 * @returns Tools in Mistral's `Tool` shape.
 */
export const convertTools = (tools: TMCPItem[]): Tool[] =>
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
