import type { TMCPItem } from "../../../types";
import type { HostTool, HostToolGroup } from "../types";

/**
 * Convert a {@link HostTool} to the wire {@link TMCPItem}, qualifying the
 * name with its group id and carrying `requireApproval` through so the
 * engine can honour it when computing auto-allow. Defaults to `false`
 * per the {@link HostTool.requireApproval} contract — no dialog under the
 * "auto" permission mode; "ask" still prompts unless always-allowed.
 */
const toItem = (group: HostToolGroup, tool: HostTool): TMCPItem => ({
  name: emittedName(group, tool),
  displayName: tool.displayName ?? tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
  requireApproval: tool.requireApproval ?? false,
});

// The name the model sees: qualified with the group id by default, bare
// when the group opts out via `qualifyNames: false`.
const emittedName = (group: HostToolGroup, tool: HostTool): string =>
  group.qualifyNames === false ? tool.name : `${group.id}_${tool.name}`;

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

  /**
   * Get all tools from all groups, keyed by group.id.
   *
   * Tool names are emitted *qualified* — `${group.id}_${tool.name}` —
   * so the LLM sees a unique name per source and the engine can route
   * the resulting tool-call back to the right group via `getServerType`.
   * Internal lookups (e.g. {@link callTool}) still use the bare name.
   */
  getToolsByGroup(): Record<string, TMCPItem[]> {
    const result: Record<string, TMCPItem[]> = {};

    for (const group of this.groups) {
      result[group.id] = group.tools.map((tool) => toItem(group, tool));
    }

    return result;
  }

  /** Get flat list of all tools (for backward compat with old getTools()) */
  getAllTools(): TMCPItem[] {
    return this.groups.flatMap((group) =>
      group.tools.map((tool) => toItem(group, tool))
    );
  }

  /**
   * Resolve the owning group id for a tool name exactly as it was emitted
   * to the model (qualified or bare, per the group's `qualifyNames`).
   * Returns `undefined` when no group emitted that name — the caller then
   * falls back to prefix matching / other sources.
   */
  getGroupIdForEmittedName(name: string): string | undefined {
    for (const group of this.groups) {
      if (group.tools.some((tool) => emittedName(group, tool) === name)) {
        return group.id;
      }
    }
    return undefined;
  }

  /** Resolve a group's display label: explicit `name` falls back to `id`. */
  getGroupDisplayName(groupId: string): string {
    const group = this.groups.find((g) => g.id === groupId);
    return group?.name ?? groupId;
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

  /** Get all group IDs */
  getGroupIds(): string[] {
    return this.groups.map((g) => g.id);
  }

  /**
   * Whether a group emits bare tool names (`qualifyNames: false`) — its
   * emitted names must not be prefix-stripped before {@link callTool}.
   */
  emitsBareNames(groupId: string): boolean {
    return this.groups.find((g) => g.id === groupId)?.qualifyNames === false;
  }
}
