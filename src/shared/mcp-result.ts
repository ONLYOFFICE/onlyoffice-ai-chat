/**
 * Serialise an MCP `tools/call` result to the string the model receives.
 *
 * Drops `structuredContent` first. The MCP spec requires a server that
 * returns `structuredContent` to also mirror it as a text block in
 * `content`, so the field only duplicates data the model already gets —
 * paying for the same payload twice in tokens. Non-object results are
 * serialised as is.
 */
export function serializeMcpToolResult(result: unknown): string {
  return JSON.stringify(stripStructuredContent(result));
}

/** Return `result` without its `structuredContent` field, if it has one. */
export function stripStructuredContent(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }
  if (!("structuredContent" in result)) return result;
  const { structuredContent, ...rest } = result as Record<string, unknown>;
  void structuredContent;
  return rest;
}
