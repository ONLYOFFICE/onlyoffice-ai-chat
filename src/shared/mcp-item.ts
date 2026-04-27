/**
 * Descriptor for a tool exposed by an MCP server.
 *
 * @example
 * ```ts
 * const tool: TMCPItem = {
 *   name: "web_search",
 *   description: "Search the web for information",
 *   inputSchema: { type: "object", properties: { query: { type: "string" } } },
 *   enabled: true,
 * };
 * ```
 */
export type TMCPItem = {
  /** Tool name as registered on the MCP server (e.g. `"web_search"`, `"insert_text"`). */
  name: string;

  /** Human-readable description shown to the AI model and in the tools list UI. */
  description: string;

  /** JSON Schema describing the tool's input parameters. */
  inputSchema: Record<string, unknown>;

  /** Whether this tool is currently enabled. Disabled tools are hidden from the AI model. */
  enabled?: boolean;
};
