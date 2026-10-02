import {
  DEFAULT_TOOL_PERMISSION_MODE,
  isToolPermissionMode,
  type ToolPermissionMode,
} from "../../../shared/tool-permission-mode";
import type { StorageAdapter } from "../../storage";

/**
 * Whether one tool call runs without the approval dialog.
 *
 * - `"ask"` — only a tool the user pinned to the persisted always-allow
 *   list skips the dialog. A tool's own `requireApproval: false` (the
 *   default for host tools) is ignored: the user asked to be asked.
 * - `"auto"` — the always-allow list, plus every tool that opted out of
 *   approval through `requireApproval === false`. A tool that never sets
 *   the flag (MCP / custom servers) keeps prompting.
 * - `"allow"` — every call runs without asking.
 */
export function resolveAutoAllow(
  mode: ToolPermissionMode,
  tool: { allowListed: boolean; requireApproval?: boolean }
): boolean {
  switch (mode) {
    case "allow":
      return true;
    case "auto":
      return tool.allowListed || tool.requireApproval === false;
    case "ask":
      return tool.allowListed;
  }
}

/**
 * The permission mode in force for one scope: the persisted mode, or
 * `fallback` where none was stored, the adapter predates the mode
 * methods, or the stored value is not a mode at all (a host answering
 * the route with something unexpected must not switch the dialog off).
 * `fallback` is the host's `PreferenceDefaults.toolPermissionMode`
 * where it overrides one, so the engine and the UI agree on the default.
 */
export async function readToolPermissionMode(
  storage: StorageAdapter,
  entityId?: string,
  fallback: ToolPermissionMode = DEFAULT_TOOL_PERMISSION_MODE
): Promise<ToolPermissionMode> {
  const stored = await storage.preferences?.readToolPermissionMode?.(entityId);
  return isToolPermissionMode(stored) ? stored : fallback;
}
