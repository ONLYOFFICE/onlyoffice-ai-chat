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

  /**
   * Server type (MCP server name / host tool group id) this tool belongs
   * to — the key the persisted disabled map is stored under. Set by the
   * source that enumerated the tool, so a caller-supplied tool can still
   * be attributed to its group after being flattened into a single list:
   * that is what lets the engine apply the disabled map to
   * `actionArgs.tools` instead of trusting the caller to pre-filter.
   * Wire-serializable, so it survives a remote (server-side) engine.
   */
  serverType?: string;

  /**
   * Whether the consumer must show an approval dialog before this tool
   * runs. The engine reads it when deciding the `autoAllow` flag on a
   * `tool-call-pending` event: `requireApproval === false` auto-allows the
   * call (no dialog), `true` always prompts. `undefined` leaves the
   * decision to the persisted "always-allow" list alone — so MCP /
   * custom-server tools (which never set it) keep prompting as before,
   * while host tools opt into auto-allow by default. Wire-serializable, so
   * it survives a remote (server-side) engine.
   */
  requireApproval?: boolean;
};
