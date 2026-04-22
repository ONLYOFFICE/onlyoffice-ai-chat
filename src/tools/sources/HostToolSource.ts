import type { TMCPItem } from "../../types";
import type { HostToolGroup } from "../types";

/**
 * Replaces DesktopEditorTool.
 * Wraps HostToolGroup[] (from ToolsProvider) into the same interface
 * that Servers class expects: getTools() returns TMCPItem[] per group,
 * callTools() routes to the correct handler.
 */
export class HostToolSource {
  private groups: HostToolGroup[] = [];

  setGroups(groups: HostToolGroup[]) {
    this.groups = groups;
  }

  /** Get all tools from all groups, keyed by group.id */
  getToolsByGroup(): Record<string, TMCPItem[]> {
    const result: Record<string, TMCPItem[]> = {};

    for (const group of this.groups) {
      result[group.id] = group.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    }

    return result;
  }

  /** Get flat list of all tools (for backward compat with old getTools()) */
  getAllTools(): TMCPItem[] {
    return this.groups.flatMap((group) =>
      group.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }))
    );
  }

  /**
   * Call a tool by name. Searches across all groups.
   *
   * The underlying provider SDKs (OpenAI, Anthropic) require the tool-result
   * `content` to be a string, so we normalise whatever the handler returns
   * here: strings pass through untouched; everything else is JSON-serialised.
   * Errors during the handler are caught and returned as a stringified
   * `{ error }` payload so one broken tool doesn't tear down the stream.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    for (const group of this.groups) {
      const tool = group.tools.find((t) => t.name === name);
      if (!tool) continue;
      try {
        const result = await tool.handler(args);
        if (typeof result === "string") return result;
        if (result === undefined || result === null) return "{}";
        try {
          return JSON.stringify(result);
        } catch {
          return JSON.stringify({ error: "Tool result is not serialisable." });
        }
      } catch (e) {
        return JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return "{}";
  }

  /** Check if a tool in a given group should auto-allow (no approval dialog) */
  isAutoAllow(groupId: string, toolName: string): boolean {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const tool = group.tools.find((t) => t.name === toolName);
    if (!tool) return false;
    return !tool.requireApproval;
  }

  /** Get all group IDs */
  getGroupIds(): string[] {
    return this.groups.map((g) => g.id);
  }
}
