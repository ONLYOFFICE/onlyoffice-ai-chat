import type { AssignmentsStorage } from "./assignments";
import type { AttachmentsStorage } from "./attachments";
import type { ContextFolder, RoomSkill } from "./context-folders";
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
 *   attachments: new MyAttachmentsStorage(),
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

  /** User-message attachment storage (files + images). */
  attachments: AttachmentsStorage;

  /**
   * List the rooms the user may add to the conversation as context, grouped
   * by cloud account. Read when the composer's settings menu mounts — one
   * row per cloud, rooms inside — the host decides what is listed and in
   * what order.
   *
   * Optional: a host with no room concept leaves it out and the menu
   * shows no cloud rows.
   */
  getContextFolders?(): Promise<ContextFolder[]>;

  /**
   * List the skills configured in one room, identified by the `cloud` and
   * room `id` a {@link ContextFolder} carried — frontmatter only (`name`,
   * `description`), never the bodies. Read once a room is connected as
   * context, and again before every round: the composer shows each skill
   * with its own switch, and the model gets the enabled ones as an index
   * in its system prompt.
   *
   * Optional, like `getContextFolders`: without it a connected room simply
   * lists no skills.
   */
  getRoomSkills?(cloud: string, roomId: string): Promise<RoomSkill[]>;

  /**
   * The body of one skill — the Markdown after the frontmatter, or the
   * whole file; the model reads it as text either way. Called only when the
   * model asks for that skill through the built-in `read_skill` tool, so a
   * room with many skills costs the context window one index line each,
   * not every body on every turn.
   *
   * Optional; without it the tool answers that the skill cannot be read.
   */
  getRoomSkill?(
    cloud: string,
    roomId: string,
    skillId: string
  ): Promise<string>;

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
