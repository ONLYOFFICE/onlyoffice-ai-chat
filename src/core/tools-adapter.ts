import type { TMCPItem } from "../shared/mcp-item";

/**
 * Pluggable runtime source of tools available to the AI engine.
 *
 * Mirrors the {@link StorageAdapter} pattern: consumers depend only on
 * this interface, the engine is injected with a concrete implementation
 * via {@link AIEngineDeps}. The built-in implementation aggregates host
 * tools, web-search, and MCP servers; alternative implementations can
 * fetch tools from a remote registry, a server-side dispatcher, etc.
 *
 * Every method receives the active `entityId` (opaque scope token for
 * entity-bound chat, e.g. "rooms"). Implementations that don't care
 * about scoping can ignore it; entity-aware ones can return a different
 * tool list per room or route execution to a per-room backend. The
 * value mirrors `WidgetConfig.entityId` and is `undefined` for global
 * (non-scoped) chat.
 */
export interface ToolsAdapter {
  /**
   * Return the tools currently available to the AI engine, grouped by
   * `serverType` (the same key used in
   * `storage.toolPrefs.readDisabled()`). Called once per request before
   * the provider stream starts.
   *
   * Grouping lets the engine apply the persisted disabled-tool filter
   * without parsing prefixes out of tool names.
   *
   * `config.attachmentId` carries the attachment ref ids of the current
   * user message (de-duplicated, in order). Useful for adapters that
   * surface attachment-specific tools (e.g. PDF parsers when a PDF is
   * attached). The list is empty for messages without attachments and
   * absent on resume rounds.
   */
  getTools(
    entityId?: string,
    config?: { attachmentId: string[] }
  ): Promise<Record<string, TMCPItem[]>>;

  /**
   * Execute a tool by name and return its raw result. Implementations
   * should stringify thrown errors into the result so the model can
   * react to them rather than aborting the stream.
   */
  callTool(
    toolName: string,
    args: Record<string, unknown>,
    entityId?: string
  ): Promise<unknown>;
}
