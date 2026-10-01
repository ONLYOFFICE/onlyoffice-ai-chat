/**
 * The key one tool is pinned under in the persisted "always-allow" list.
 *
 * The list holds `${serverType}_${toolName}` tokens (server names cannot
 * contain `_`, see `validateServerName`), so a permission granted to a
 * tool of one server never reaches a same-named tool of another (DocSpace
 * bug 83161). Every path that touches the list — the settings routes, the
 * approval dialog's "Always allow" and the live round's auto-allow check —
 * must derive the token the same way, or a decision saved by one is
 * invisible to the others (DocSpace bug 84009).
 *
 * Two shapes are handled:
 *
 * - a tool whose group is known (`serverType` set) and whose name is bare,
 *   the way MCP servers expose theirs — the token is composed;
 * - a tool whose name already carries its group prefix (host-tool groups
 *   qualify names by default, `group.id_tool`), or a tool with no known
 *   group at all — the name is the token as it stands.
 */
export function allowAlwaysToken(
  serverType: string | undefined,
  toolName: string
): string {
  if (!serverType || toolName.startsWith(`${serverType}_`)) return toolName;
  return `${serverType}_${toolName}`;
}
