import type { TMCPItem } from "../types";

/**
 * A single tool that the host application exposes to the AI model.
 *
 * Host tools are grouped via {@link HostToolGroup} and registered through
 * the platform adapter. The tool name is automatically prefixed with the
 * group ID when exposed to the model (e.g. `"desktop_editor_insert_text"`).
 *
 * @example
 * ```ts
 * const insertText: HostTool = {
 *   name: "insert_text",
 *   description: "Insert text at the current cursor position in the document",
 *   inputSchema: {
 *     type: "object",
 *     properties: {
 *       text: { type: "string", description: "Text to insert" },
 *     },
 *     required: ["text"],
 *   },
 *   handler: async (args) => {
 *     editor.insertText(args.text as string);
 *     return { success: true };
 *   },
 *   requireApproval: true,
 * };
 * ```
 */
export interface HostTool {
  /** Unique tool name (e.g. "insert_text", "get_selection"). Will be prefixed with "{group.id}_" internally */
  name: string;

  /** Human-readable description shown to the AI model and in the tools list UI */
  description: string;

  /** JSON Schema describing the tool's input parameters */
  inputSchema: Record<string, unknown>;

  /** The function that executes the tool. Called with parsed arguments, returns a result for the AI model */
  handler: (args: Record<string, unknown>) => Promise<unknown>;

  /** Whether to show an approval dialog before executing. Default: false (auto-allow) */
  requireApproval?: boolean;
}

/**
 * A named group of {@link HostTool}s, displayed as a section in the tools
 * list UI.
 *
 * The group `id` is used as a namespace prefix for all tools in the group,
 * ensuring tool names remain unique across different groups.
 *
 * @example
 * ```ts
 * const editorTools: HostToolGroup = {
 *   id: "desktop_editor",
 *   name: "Desktop Editor",
 *   tools: [
 *     {
 *       name: "get_selection",
 *       description: "Get the currently selected text",
 *       inputSchema: { type: "object", properties: {} },
 *       handler: async () => ({ text: editor.getSelection() }),
 *     },
 *     {
 *       name: "insert_text",
 *       description: "Insert text at cursor",
 *       inputSchema: {
 *         type: "object",
 *         properties: { text: { type: "string" } },
 *         required: ["text"],
 *       },
 *       handler: async (args) => {
 *         editor.insertText(args.text as string);
 *         return { success: true };
 *       },
 *       requireApproval: true,
 *     },
 *   ],
 * };
 * ```
 */
export interface HostToolGroup {
  /** Group ID used as source prefix in qualified names (e.g. "desktop_editor" → "desktop_editor_insert_text") */
  id: string;

  /** Display name shown in the tools list UI (e.g. "Desktop Editor", "CRM Tools") */
  name: string;

  /** Tools in this group */
  tools: HostTool[];
}

/**
 * Interface for any tool source that can provide and execute tools.
 *
 * The chat engine discovers available tools by calling {@link getTools} and
 * invokes them via {@link callTool}. Three built-in implementations exist:
 * - **HostToolSource** — wraps {@link HostToolGroup}s from the host app.
 * - **WebSearch** — Exa-powered web search tool.
 * - **CustomServers** — MCP servers communicating via JSON-RPC 2.0.
 *
 * @example
 * ```ts
 * const mySource: ToolSource = {
 *   id: "my-custom-source",
 *   autoAllow: true,
 *   getTools() {
 *     return [
 *       {
 *         name: "current_time",
 *         description: "Returns the current UTC time",
 *         inputSchema: { type: "object", properties: {} },
 *         source: "my-custom-source",
 *         checked: true,
 *       },
 *     ];
 *   },
 *   async callTool(_name, _args) {
 *     return { time: new Date().toISOString() };
 *   },
 * };
 * ```
 */
export interface ToolSource {
  /** Unique source ID: host group id | "web-search" | "mcp-{serverName}" */
  id: string;

  /** Fetch available tools from this source */
  getTools(): Promise<TMCPItem[]> | TMCPItem[];

  /** Execute a tool from this source by name */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;

  /** Whether tools from this source are auto-allowed (no approval dialog). Default: false */
  autoAllow?: boolean;
}
