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
   * runs. Feeds the `autoAllow` flag on a `tool-call-pending` event
   * together with the user's tool permission mode: `false` skips the
   * dialog under the "auto" mode (under "ask", the default, only the
   * persisted "always-allow" list does), `true` and `undefined` defer to
   * that list; "allow" skips it for every tool. Host tools set it and
   * default to `false`; MCP / custom-server tools leave it unset.
   * Wire-serializable, so it survives a remote (server-side) engine.
   */
  requireApproval?: boolean;

  /**
   * The MCP tool annotations as the server declared them in `tools/list`
   * (kept verbatim on the descriptor; never sent to the model). The
   * approval flow reads two of them under the "auto" permission mode:
   * `readOnlyHint: true` and `destructiveHint: false` run without the
   * dialog, a destructive or unannotated tool keeps asking — see
   * `resolveAutoAllow`. Wire-serializable.
   */
  annotations?: ToolAnnotations;
};

/**
 * MCP tool annotations (`Tool.annotations` in the protocol). All hints are
 * advisory and optional; the protocol's defaults are `readOnlyHint: false`
 * and `destructiveHint: true`, which is why an unannotated tool is treated
 * as one that may destroy state.
 */
export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};
