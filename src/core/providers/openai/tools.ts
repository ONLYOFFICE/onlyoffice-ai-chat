import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { TMCPItem } from "../../../shared/mcp-item";

/**
 * Convert MCP tool descriptors into OpenAI's function-calling tool format.
 *
 * Only the `type: "function"` shape is produced — OpenAI's other tool
 * types (file_search, code_interpreter, ...) aren't reachable through MCP
 * and are out of scope for this library.
 *
 * @param tools - Tool descriptors from the MCP layer.
 * @returns Tools wrapped in OpenAI's `ChatCompletionTool` shape.
 */
export const convertTools = (tools: TMCPItem[]): ChatCompletionTool[] =>
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: { ...tool.inputSchema },
    },
  }));
