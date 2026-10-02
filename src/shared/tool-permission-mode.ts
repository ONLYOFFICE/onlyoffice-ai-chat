/**
 * How the chat treats a tool call the model makes.
 *
 * - `"ask"` — every call waits for the user's approval, except the tools
 *   the user has already marked "always allow". A tool's own
 *   `requireApproval: false` does not count here.
 * - `"auto"` — the always-allow list, every tool that opted out of
 *   approval through `requireApproval: false` (host tools default to it),
 *   and every MCP tool annotated `readOnlyHint: true` or
 *   `destructiveHint: false`; a destructive or unannotated tool asks.
 * - `"allow"` — every call runs without asking.
 *
 * Resolved per call by `core/services/tools/auto-allow.ts`.
 *
 * Stored as a user preference next to the thinking depth; the composer's
 * "Permissions" row at the foot of the model picker switches it.
 */
export type ToolPermissionMode = "ask" | "auto" | "allow";

/** Every {@link ToolPermissionMode}, most cautious first. */
export const TOOL_PERMISSION_MODES: readonly ToolPermissionMode[] = [
  "ask",
  "auto",
  "allow",
];

/** The mode in force until the user picks another. */
export const DEFAULT_TOOL_PERMISSION_MODE: ToolPermissionMode = "ask";

/** Type guard for {@link ToolPermissionMode}. */
export function isToolPermissionMode(
  value: unknown
): value is ToolPermissionMode {
  return (
    typeof value === "string" &&
    (TOOL_PERMISSION_MODES as readonly string[]).includes(value)
  );
}
