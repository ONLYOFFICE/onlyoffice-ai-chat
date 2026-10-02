import {
  DEFAULT_TOOL_PERMISSION_MODE,
  isToolPermissionMode,
  type ToolPermissionMode,
} from "../../../shared/tool-permission-mode";
import type { StorageAdapter } from "../../storage";
import type { ToolAnnotations } from "../../../shared/mcp-item";

/**
 * Whether one tool call runs without the approval dialog.
 *
 * - `"ask"` — only a tool the user pinned to the persisted always-allow
 *   list skips the dialog. A tool's own `requireApproval: false` (the
 *   default for host tools) and its MCP annotations are ignored: the user
 *   asked to be asked.
 * - `"auto"` — the always-allow list, every tool that opted out of
 *   approval through `requireApproval === false`, and every tool whose
 *   MCP annotations say it cannot destroy anything: `readOnlyHint: true`
 *   or an explicit `destructiveHint: false`. A destructive tool, and a
 *   tool with no annotations at all (the protocol's default is
 *   destructive), keeps prompting.
 * - `"allow"` — every call runs without asking.
 */
export function resolveAutoAllow(
  mode: ToolPermissionMode,
  tool: {
    allowListed: boolean;
    requireApproval?: boolean;
    annotations?: ToolAnnotations;
  }
): boolean {
  switch (mode) {
    case "allow":
      return true;
    case "auto":
      return (
        tool.allowListed ||
        tool.requireApproval === false ||
        isHarmless(tool.annotations)
      );
    case "ask":
      return tool.allowListed;
  }
}

/**
 * Whether the annotations promise the tool leaves state alone: read-only,
 * or explicitly non-destructive. Only `true`/`false` literals count — a
 * truthy string from a sloppy server is not a promise.
 */
function isHarmless(annotations: ToolAnnotations | undefined): boolean {
  if (!annotations) return false;
  return (
    annotations.readOnlyHint === true || annotations.destructiveHint === false
  );
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
