import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  Model,
  Profile,
  Prompt,
  PromptFolder,
  Thread,
  TProvider,
} from "../types";

/**
 * Storage interface for managing chat threads (conversations).
 *
 * Each thread represents a single chat session with a title, an optional
 * provider/model binding, and a `lastEditDate` that is bumped whenever
 * the thread is modified. Implementations must persist data across
 * page reloads (e.g. IndexedDB, REST API, etc.).
 */
export interface ThreadsStorage {
  /**
   * Create a new thread and persist it to storage.
   *
   * @param threadId - Unique identifier for the thread.
   * @param title - Human-readable title shown in the sidebar.
   * @param provider - Optional AI provider key bound to this thread.
   * @param model - Optional model bound to this thread.
   * @param profileId - Optional profile ID that owns this thread.
   */
  create(
    threadId: string,
    title: string,
    provider?: TProvider,
    model?: Model,
    profileId?: string
  ): Promise<void>;

  /**
   * Retrieve all threads sorted by `lastEditDate` descending (newest first).
   *
   * @returns An array of all persisted threads.
   */
  getAll(): Promise<Thread[]>;

  /**
   * Find a thread by its ID.
   *
   * @param threadId - The thread identifier to look up.
   * @returns The matching thread, or `null` if not found.
   */
  getById(threadId: string): Promise<Thread | null>;

  /**
   * Update a thread's title. Also bumps `lastEditDate`.
   *
   * @param threadId - The thread to update.
   * @param title - The new title, if provided.
   */
  update(threadId: string, title?: string): Promise<void>;

  /**
   * Bump `lastEditDate` and optionally update provider, model, or profileId.
   * Called when a new message is sent in the thread.
   *
   * @param threadId - The thread to touch.
   * @param updates - Optional fields to update alongside the timestamp.
   */
  touch(
    threadId: string,
    updates?: {
      provider?: TProvider | null;
      model?: Model | null;
      profileId?: string | null;
    }
  ): Promise<void>;

  /**
   * Delete a thread and all its messages (cascading delete).
   *
   * @param threadId - The thread to remove.
   */
  delete(threadId: string): Promise<void>;
}

/**
 * Storage interface for managing individual chat messages within threads.
 *
 * Messages are stored with a timestamp and are always scoped to a parent
 * thread. Implementations must support full-text search across all
 * message content.
 */
export interface MessagesStorage {
  /**
   * Save a new message in a thread. Automatically sets the timestamp
   * to `Date.now()`.
   *
   * @param threadId - The parent thread ID.
   * @param id - Unique identifier for the message.
   * @param message - The message content conforming to `ThreadMessageLike`.
   */
  create(
    threadId: string,
    id: string,
    message: ThreadMessageLike
  ): Promise<void>;

  /**
   * Get all messages for a thread sorted by timestamp ascending
   * (oldest first). Optionally limit to the last N messages.
   *
   * @param threadId - The thread whose messages to retrieve.
   * @param limit - If provided, return only the last `limit` messages.
   * @returns An array of messages in chronological order.
   */
  getByThread(threadId: string, limit?: number): Promise<ThreadMessageLike[]>;

  /**
   * Find a specific message by ID within a thread.
   *
   * @param threadId - The parent thread ID.
   * @param messageId - The message identifier to look up.
   * @returns The matching message, or `null` if not found.
   */
  getById(
    threadId: string,
    messageId: string
  ): Promise<ThreadMessageLike | null>;

  /**
   * Update message content (e.g. after receiving a tool result).
   * Also updates the timestamp.
   *
   * @param messageId - The message to update.
   * @param message - The replacement message content.
   */
  update(messageId: string, message: ThreadMessageLike): Promise<void>;

  /**
   * Delete a single message by ID.
   *
   * @param messageId - The message to remove.
   */
  delete(messageId: string): Promise<void>;

  /**
   * Delete all messages in a thread. Used for clearing history or as
   * part of a cascading thread delete.
   *
   * @param threadId - The thread whose messages should be removed.
   */
  deleteByThread(threadId: string): Promise<void>;

  /**
   * Replace all messages in a thread with a new array.
   * Used for bulk operations such as import or reorder.
   *
   * @param threadId - The thread whose messages to replace.
   * @param messages - The new complete set of messages.
   */
  replaceByThread(
    threadId: string,
    messages: ThreadMessageLike[]
  ): Promise<void>;

  /**
   * Full-text case-insensitive search across all message content.
   *
   * @param query - The search string to match against message text.
   * @returns An array of `{ threadId, message }` pairs for every match.
   */
  search(
    query: string
  ): Promise<{ threadId: string; message: ThreadMessageLike }[]>;
}

/**
 * Storage interface for managing AI provider profiles.
 *
 * A profile contains an API key, provider type, selected model, and
 * capability flags. Profiles are referenced by threads and used by the
 * `ChatEngine` to route requests to the correct provider.
 */
export interface ProfilesStorage {
  /**
   * Create a single AI provider profile.
   *
   * @param profile - The profile to persist.
   */
  create(profile: Profile): Promise<void>;

  /**
   * Create multiple profiles in a single transaction.
   * Used for migration or bulk import.
   *
   * @param profiles - The array of profiles to persist.
   */
  createMany(profiles: Profile[]): Promise<void>;

  /**
   * Retrieve all profiles.
   *
   * @returns An array of all persisted profiles.
   */
  getAll(): Promise<Profile[]>;

  /**
   * Find a profile by ID.
   *
   * @param id - The profile identifier to look up.
   * @returns The matching profile, or `undefined` if not found.
   */
  getById(id: string): Promise<Profile | undefined>;

  /**
   * Update a profile by replacing all fields.
   *
   * @param profile - The profile with updated values. Must include the `id`.
   */
  update(profile: Profile): Promise<void>;

  /**
   * Delete a profile by ID.
   *
   * @param id - The profile to remove.
   */
  delete(id: string): Promise<void>;
}

/**
 * Storage interface for managing saved prompts (reusable prompt templates).
 *
 * Prompts can optionally belong to a {@link PromptFolder}. Deleting a
 * folder cascades to all prompts within it via {@link deleteByFolder}.
 */
export interface PromptsStorage {
  /**
   * Create a new saved prompt.
   *
   * @param prompt - The prompt to persist.
   */
  create(prompt: Prompt): Promise<void>;

  /**
   * Retrieve all prompts sorted by `createdAt` descending (newest first).
   *
   * @returns An array of all persisted prompts.
   */
  getAll(): Promise<Prompt[]>;

  /**
   * Find a prompt by ID.
   *
   * @param id - The prompt identifier to look up.
   * @returns The matching prompt, or `null` if not found.
   */
  getById(id: string): Promise<Prompt | null>;

  /**
   * Partially update a prompt: name, text, and/or folderId.
   * Updates the `updatedAt` timestamp.
   *
   * @param id - The prompt to update.
   * @param updates - An object with optional `name`, `text`, and `folderId` fields.
   */
  update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ): Promise<void>;

  /**
   * Delete a single prompt by ID.
   *
   * @param id - The prompt to remove.
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all prompts in a folder. Called as part of a cascading delete
   * when a folder is removed.
   *
   * @param folderId - The folder whose prompts should be deleted.
   */
  deleteByFolder(folderId: string): Promise<void>;
}

/**
 * Storage interface for managing prompt folders.
 *
 * Folders provide a simple one-level grouping mechanism for saved prompts.
 * Deleting a folder cascades to all prompts it contains.
 */
export interface PromptFoldersStorage {
  /**
   * Create a new prompt folder.
   *
   * @param folder - The folder to persist.
   */
  create(folder: PromptFolder): Promise<void>;

  /**
   * Retrieve all folders sorted by `createdAt` descending (newest first).
   *
   * @returns An array of all persisted folders.
   */
  getAll(): Promise<PromptFolder[]>;

  /**
   * Find a folder by ID.
   *
   * @param id - The folder identifier to look up.
   * @returns The matching folder, or `null` if not found.
   */
  getById(id: string): Promise<PromptFolder | null>;

  /**
   * Rename a folder. Updates the `updatedAt` timestamp.
   *
   * @param id - The folder to rename.
   * @param name - The new folder name.
   */
  update(id: string, name: string): Promise<void>;

  /**
   * Delete a folder and all prompts inside it (cascading delete).
   *
   * @param id - The folder to remove.
   */
  delete(id: string): Promise<void>;
}

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
