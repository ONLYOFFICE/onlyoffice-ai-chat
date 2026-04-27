import type { AssignmentsStorage } from "./assignments";
import type { McpServersStorage } from "./mcp-servers";
import type { MessagesStorage } from "./messages";
import type { PreferencesStorage } from "./preferences";
import type { ProfilesStorage } from "./profiles";
import type { PromptFoldersStorage } from "./prompt-folders";
import type { PromptsStorage } from "./prompts";
import type { ThreadsStorage } from "./threads";
import type { ToolPrefsStorage } from "./tool-prefs";
import type { WebSearchStorage } from "./web-search";

/**
 * Unified storage adapter that aggregates all domain-specific storage
 * interfaces into a single injectable dependency.
 *
 * The adapter is provided to the widget via React context and follows
 * the adapter pattern — consumers depend only on this interface, never
 * on a concrete implementation. The built-in implementation uses
 * IndexedDB, but any backend (REST API, SQLite, in-memory, etc.) can
 * be substituted.
 *
 * @example
 * ```ts
 * import type { StorageAdapter } from "@onlyoffice/ai-chat";
 *
 * const myStorage: StorageAdapter = {
 *   threads: new MyThreadsStorage(),
 *   messages: new MyMessagesStorage(),
 *   profiles: new MyProfilesStorage(),
 *   prompts: new MyPromptsStorage(),
 *   promptFolders: new MyPromptFoldersStorage(),
 *   assignments: new MyAssignmentsStorage(),
 *   preferences: new MyPreferencesStorage(),
 *   mcpServers: new MyMcpServersStorage(),
 *   toolPrefs: new MyToolPrefsStorage(),
 *   webSearch: new MyWebSearchStorage(),
 *
 *   async init() {
 *     // Open database connection, run migrations, etc.
 *   },
 *
 *   async close() {
 *     // Close database connection, flush pending writes, etc.
 *   },
 * };
 * ```
 */
export interface StorageAdapter {
  /** Thread (chat session) storage. */
  threads: ThreadsStorage;

  /** Message storage scoped to threads. */
  messages: MessagesStorage;

  /** AI provider profile storage. */
  profiles: ProfilesStorage;

  /** Saved prompt template storage. */
  prompts: PromptsStorage;

  /** Prompt folder storage for grouping prompts. */
  promptFolders: PromptFoldersStorage;

  /** Per-{@link ActionType} profile assignments. */
  assignments: AssignmentsStorage;

  /** Scalar user preferences (e.g. extended-thinking toggle). */
  preferences: PreferencesStorage;

  /** Custom MCP server registrations. */
  mcpServers: McpServersStorage;

  /** Per-tool disabled / auto-approved preferences. */
  toolPrefs: ToolPrefsStorage;

  /** Singleton web-search provider configuration. */
  webSearch: WebSearchStorage;

  /**
   * Initialize the storage backend (create DB/tables, run migrations).
   * Called once on startup before any other storage method is invoked.
   */
  init(): Promise<void>;

  /**
   * Close the storage connection and release resources.
   * Called when `AIChatProvider` unmounts.
   */
  close(): Promise<void>;
}
