import type { FunctionDeclaration } from "@google/genai";
import type { TMCPItem } from "../../../shared/mcp-item";
import { sanitizeGeminiSchema } from "./schema";

/**
 * Convert MCP tool descriptors into Google GenAI `FunctionDeclaration`s.
 *
 * GenAI expects JSON-Schema-like parameters with a top-level
 * `type: "OBJECT"` (note the uppercase convention used by the SDK);
 * the MCP input schema is merged in underneath after
 * {@link sanitizeGeminiSchema} has reduced it to what Gemini accepts.
 *
 * @param tools - Tool descriptors from the MCP layer.
 * @returns Tools in GenAI's `FunctionDeclaration` shape.
 */
export const convertTools = (tools: TMCPItem[]): FunctionDeclaration[] =>
  tools.map(
    (tool) =>
      ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "OBJECT",
          ...sanitizeGeminiSchema(tool.inputSchema),
        },
      }) as FunctionDeclaration
  );
