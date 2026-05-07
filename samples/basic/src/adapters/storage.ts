import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  AssignmentsStorage,
  Attachment,
  AttachmentsStorage,
  McpServerConfig,
  McpServersStorage,
  MessagesStorage,
  PreferencesStorage,
  Profile,
  ProfilesStorage,
  Prompt,
  PromptFolder,
  PromptFoldersStorage,
  PromptsStorage,
  StorageAdapter,
  Thread,
  ThreadsStorage,
  ToolPrefsStorage,
  WebSearchConfig,
  WebSearchStorage,
} from "@onlyoffice/ai-chat";
import { ActionType } from "@onlyoffice/ai-chat";

const DB_VERSION = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function uuid(): string {
  return crypto.randomUUID();
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("threads")) {
        const threads = db.createObjectStore("threads", {
          keyPath: "threadId",
        });
        threads.createIndex("lastEditDate", "lastEditDate");
      }

      if (!db.objectStoreNames.contains("messages")) {
        const messages = db.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("threadId", "threadId");
      }

      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("prompts")) {
        const prompts = db.createObjectStore("prompts", { keyPath: "id" });
        prompts.createIndex("folderId", "folderId");
      }

      if (!db.objectStoreNames.contains("promptFolders")) {
        db.createObjectStore("promptFolders", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("assignments")) {
        db.createObjectStore("assignments", { keyPath: "actionType" });
      }

      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("mcpServers")) {
        db.createObjectStore("mcpServers", { keyPath: "name" });
      }

      if (!db.objectStoreNames.contains("toolPrefs")) {
        db.createObjectStore("toolPrefs", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("webSearch")) {
        db.createObjectStore("webSearch", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("attachments")) {
        const attachments = db.createObjectStore("attachments", {
          keyPath: "id",
        });
        attachments.createIndex("messageId", "messageId");
        attachments.createIndex("threadId", "threadId");
        attachments.createIndex("entityId", "entityId");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

class IDBThreads implements ThreadsStorage {
  constructor(private db: IDBDatabase) {}

  async create(title: string, profileId?: string): Promise<Thread> {
    const thread: Thread = {
      threadId: uuid(),
      title,
      lastEditDate: Date.now(),
      profileId,
    };
    const store = this.db
      .transaction("threads", "readwrite")
      .objectStore("threads");
    await req(store.add(thread));
    return thread;
  }

  async readAll(): Promise<Thread[]> {
    const store = this.db
      .transaction("threads", "readonly")
      .objectStore("threads");
    const all: Thread[] = await req(store.getAll());
    return all.sort((a, b) => (b.lastEditDate ?? 0) - (a.lastEditDate ?? 0));
  }

  async readById(threadId: string): Promise<Thread | null> {
    const store = this.db
      .transaction("threads", "readonly")
      .objectStore("threads");
    return (await req(store.get(threadId))) ?? null;
  }

  async update(threadId: string, title?: string): Promise<void> {
    const t = this.db.transaction("threads", "readwrite");
    const store = t.objectStore("threads");
    const thread: Thread | undefined = await req(store.get(threadId));
    if (thread) {
      if (title !== undefined) thread.title = title;
      store.put(thread);
    }
    await tx(t);
  }

  async touch(
    threadId: string,
    lastEditDate: number,
    updates?: { profileId?: string | null }
  ): Promise<void> {
    const t = this.db.transaction("threads", "readwrite");
    const store = t.objectStore("threads");
    const thread: Thread | undefined = await req(store.get(threadId));
    if (thread) {
      thread.lastEditDate = lastEditDate;
      if (updates?.profileId !== undefined) {
        thread.profileId = updates.profileId ?? undefined;
      }
      store.put(thread);
    }
    await tx(t);
  }

  async delete(threadId: string): Promise<void> {
    const store = this.db
      .transaction("threads", "readwrite")
      .objectStore("threads");
    await req(store.delete(threadId));
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

interface MessageRecord {
  id: string;
  threadId: string;
  message: ThreadMessageLike;
  timestamp: number;
}

class IDBMessages implements MessagesStorage {
  private lastTimestamp = 0;

  constructor(private db: IDBDatabase) {}

  private nextTimestamp(): number {
    const now = Date.now();
    this.lastTimestamp = Math.max(now, this.lastTimestamp + 1);
    return this.lastTimestamp;
  }

  async create(
    threadId: string,
    message: Omit<ThreadMessageLike, "id" | "createdAt">
  ): Promise<ThreadMessageLike> {
    const id = uuid();
    const timestamp = this.nextTimestamp();
    const stored: ThreadMessageLike = {
      ...(message as ThreadMessageLike),
      id,
      createdAt: new Date(timestamp),
    };
    const record: MessageRecord = {
      id,
      threadId,
      message: stored,
      timestamp,
    };
    const store = this.db
      .transaction("messages", "readwrite")
      .objectStore("messages");
    await req(store.add(record));
    return stored;
  }

  async readByThread(
    threadId: string,
    limit?: number,
    startIndex?: number
  ): Promise<ThreadMessageLike[]> {
    const store = this.db
      .transaction("messages", "readonly")
      .objectStore("messages");
    const index = store.index("threadId");
    const records: MessageRecord[] = await req(
      index.getAll(IDBKeyRange.only(threadId))
    );
    records.sort((a, b) => a.timestamp - b.timestamp);
    const start = startIndex ?? 0;
    const end = limit !== undefined ? start + limit : undefined;
    return records
      .slice(start, end)
      .map((r) => r.message)
      .filter((m) => m && "role" in m && m.role);
  }

  async readById(messageId: string): Promise<ThreadMessageLike | null> {
    const store = this.db
      .transaction("messages", "readonly")
      .objectStore("messages");
    const record: MessageRecord | undefined = await req(store.get(messageId));
    return record?.message ?? null;
  }

  async update(messageId: string, message: ThreadMessageLike): Promise<void> {
    const t = this.db.transaction("messages", "readwrite");
    const store = t.objectStore("messages");
    const record: MessageRecord | undefined = await req(store.get(messageId));
    if (record) {
      // Preserve identity fields (id, createdAt) — the engine passes a
      // bare assistant message without them on stream updates, and losing
      // them here means the runtime falls back to index-based ids and
      // can mis-link messages across re-renders.
      record.message = {
        ...message,
        id: record.id,
        createdAt: record.message?.createdAt,
      };
      store.put(record);
    }
    await tx(t);
  }

  async delete(messageId: string): Promise<void> {
    const store = this.db
      .transaction("messages", "readwrite")
      .objectStore("messages");
    await req(store.delete(messageId));
    await deleteAttachmentsByMessage(this.db, messageId);
  }

  async deleteByThread(threadId: string): Promise<void> {
    const t = this.db.transaction("messages", "readwrite");
    const store = t.objectStore("messages");
    const index = store.index("threadId");
    const keys: IDBValidKey[] = await req(
      index.getAllKeys(IDBKeyRange.only(threadId))
    );
    for (const key of keys) {
      store.delete(key);
    }
    await tx(t);
    await deleteAttachmentsByThread(this.db, threadId);
  }
}

// Cascade helpers — co-located with `IDBMessages` so its delete paths
// can purge owned attachments without holding a back-reference to
// `IDBAttachments`. Mirrors the `attachments` index layout below.
async function deleteAttachmentsByMessage(
  db: IDBDatabase,
  messageId: string
): Promise<void> {
  const t = db.transaction("attachments", "readwrite");
  const store = t.objectStore("attachments");
  const index = store.index("messageId");
  const keys: IDBValidKey[] = await req(
    index.getAllKeys(IDBKeyRange.only(messageId))
  );
  for (const key of keys) {
    store.delete(key);
  }
  await tx(t);
}

async function deleteAttachmentsByThread(
  db: IDBDatabase,
  threadId: string
): Promise<void> {
  const t = db.transaction("attachments", "readwrite");
  const store = t.objectStore("attachments");
  const index = store.index("threadId");
  const keys: IDBValidKey[] = await req(
    index.getAllKeys(IDBKeyRange.only(threadId))
  );
  for (const key of keys) {
    store.delete(key);
  }
  await tx(t);
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

class IDBProfiles implements ProfilesStorage {
  constructor(private db: IDBDatabase) {}

  async create(
    profile: Omit<Profile, "id" | "createdAt">
  ): Promise<Profile> {
    const stored: Profile = { ...profile, id: uuid(), createdAt: Date.now() };
    const store = this.db
      .transaction("profiles", "readwrite")
      .objectStore("profiles");
    await req(store.add(stored));
    return stored;
  }

  async createMany(
    profiles: Omit<Profile, "id" | "createdAt">[]
  ): Promise<Profile[]> {
    const t = this.db.transaction("profiles", "readwrite");
    const store = t.objectStore("profiles");
    const stored: Profile[] = profiles.map((p) => ({
      ...p,
      id: uuid(),
      createdAt: Date.now(),
    }));
    for (const p of stored) {
      store.add(p);
    }
    await tx(t);
    return stored;
  }

  async readAll(): Promise<Profile[]> {
    const store = this.db
      .transaction("profiles", "readonly")
      .objectStore("profiles");
    return req(store.getAll());
  }

  async readById(id: string): Promise<Profile | undefined> {
    const store = this.db
      .transaction("profiles", "readonly")
      .objectStore("profiles");
    return req(store.get(id));
  }

  async update(profile: Profile): Promise<void> {
    const store = this.db
      .transaction("profiles", "readwrite")
      .objectStore("profiles");
    await req(store.put(profile));
  }

  async delete(id: string): Promise<void> {
    const store = this.db
      .transaction("profiles", "readwrite")
      .objectStore("profiles");
    await req(store.delete(id));
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

class IDBPrompts implements PromptsStorage {
  constructor(private db: IDBDatabase) {}

  async create(
    input: Omit<Prompt, "id" | "createdAt" | "updatedAt">
  ): Promise<Prompt> {
    const now = Date.now();
    const stored: Prompt = { ...input, id: uuid(), createdAt: now, updatedAt: now };
    const store = this.db
      .transaction("prompts", "readwrite")
      .objectStore("prompts");
    await req(store.add(stored));
    return stored;
  }

  async createMany(
    inputs: Omit<Prompt, "id" | "createdAt" | "updatedAt">[]
  ): Promise<Prompt[]> {
    const t = this.db.transaction("prompts", "readwrite");
    const store = t.objectStore("prompts");
    const now = Date.now();
    const persisted: Prompt[] = inputs.map((input) => ({
      ...input,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    }));
    for (const p of persisted) {
      store.add(p);
    }
    await tx(t);
    return persisted;
  }

  async readAll(): Promise<Prompt[]> {
    const store = this.db
      .transaction("prompts", "readonly")
      .objectStore("prompts");
    const all: Prompt[] = await req(store.getAll());
    return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async readById(id: string): Promise<Prompt | null> {
    const store = this.db
      .transaction("prompts", "readonly")
      .objectStore("prompts");
    return (await req(store.get(id))) ?? null;
  }

  async readByFolderId(folderId: string | null): Promise<Prompt[]> {
    const store = this.db
      .transaction("prompts", "readonly")
      .objectStore("prompts");
    const all: Prompt[] = await req(store.getAll());
    const filtered = all.filter((p) =>
      folderId === null ? !p.folderId : p.folderId === folderId
    );
    return filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ): Promise<void> {
    const t = this.db.transaction("prompts", "readwrite");
    const store = t.objectStore("prompts");
    const prompt: Prompt | undefined = await req(store.get(id));
    if (prompt) {
      if (updates.name !== undefined) prompt.name = updates.name;
      if (updates.text !== undefined) prompt.text = updates.text;
      if (updates.folderId !== undefined) {
        prompt.folderId = updates.folderId ?? undefined;
      }
      prompt.updatedAt = Date.now();
      store.put(prompt);
    }
    await tx(t);
  }

  async delete(id: string): Promise<void> {
    const store = this.db
      .transaction("prompts", "readwrite")
      .objectStore("prompts");
    await req(store.delete(id));
  }

  async deleteByFolder(folderId: string): Promise<void> {
    const t = this.db.transaction("prompts", "readwrite");
    const store = t.objectStore("prompts");
    const index = store.index("folderId");
    const keys: IDBValidKey[] = await req(
      index.getAllKeys(IDBKeyRange.only(folderId))
    );
    for (const key of keys) {
      store.delete(key);
    }
    await tx(t);
  }
}

// ---------------------------------------------------------------------------
// Prompt Folders
// ---------------------------------------------------------------------------

class IDBPromptFolders implements PromptFoldersStorage {
  constructor(private db: IDBDatabase) {}

  async create(
    input: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">
  ): Promise<PromptFolder> {
    const now = Date.now();
    const stored: PromptFolder = {
      ...input,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    const store = this.db
      .transaction("promptFolders", "readwrite")
      .objectStore("promptFolders");
    await req(store.add(stored));
    return stored;
  }

  async createMany(
    inputs: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">[]
  ): Promise<PromptFolder[]> {
    const t = this.db.transaction("promptFolders", "readwrite");
    const store = t.objectStore("promptFolders");
    const now = Date.now();
    const persisted: PromptFolder[] = inputs.map((input) => ({
      ...input,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    }));
    for (const f of persisted) {
      store.add(f);
    }
    await tx(t);
    return persisted;
  }

  async readAll(): Promise<PromptFolder[]> {
    const store = this.db
      .transaction("promptFolders", "readonly")
      .objectStore("promptFolders");
    const all: PromptFolder[] = await req(store.getAll());
    return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async readById(id: string): Promise<PromptFolder | null> {
    const store = this.db
      .transaction("promptFolders", "readonly")
      .objectStore("promptFolders");
    return (await req(store.get(id))) ?? null;
  }

  async update(id: string, name: string): Promise<void> {
    const t = this.db.transaction("promptFolders", "readwrite");
    const store = t.objectStore("promptFolders");
    const folder: PromptFolder | undefined = await req(store.get(id));
    if (folder) {
      folder.name = name;
      folder.updatedAt = Date.now();
      store.put(folder);
    }
    await tx(t);
  }

  async delete(id: string): Promise<void> {
    const store = this.db
      .transaction("promptFolders", "readwrite")
      .objectStore("promptFolders");
    await req(store.delete(id));
  }
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

interface AssignmentRecord {
  actionType: ActionType;
  profileId: string;
}

class IDBAssignments implements AssignmentsStorage {
  constructor(private db: IDBDatabase) {}

  async create(actionType: ActionType, profileId: string): Promise<void> {
    const t = this.db.transaction("assignments", "readwrite");
    const store = t.objectStore("assignments");
    const existing = await req(store.get(actionType));
    if (existing) {
      throw new Error(`Assignment for ${actionType} already exists`);
    }
    store.add({ actionType, profileId } satisfies AssignmentRecord);
    await tx(t);
  }

  async readByType(actionType: ActionType): Promise<string | null> {
    const store = this.db
      .transaction("assignments", "readonly")
      .objectStore("assignments");
    const record: AssignmentRecord | undefined = await req(store.get(actionType));
    return record?.profileId ?? null;
  }

  async readAll(): Promise<Partial<Record<ActionType, string>>> {
    const store = this.db
      .transaction("assignments", "readonly")
      .objectStore("assignments");
    const all: AssignmentRecord[] = await req(store.getAll());
    const result: Partial<Record<ActionType, string>> = {};
    for (const r of all) {
      result[r.actionType] = r.profileId;
    }
    return result;
  }

  async update(actionType: ActionType, profileId: string): Promise<void> {
    const t = this.db.transaction("assignments", "readwrite");
    const store = t.objectStore("assignments");
    const existing = await req(store.get(actionType));
    if (!existing) {
      throw new Error(`No assignment for ${actionType}`);
    }
    store.put({ actionType, profileId } satisfies AssignmentRecord);
    await tx(t);
  }

  async upsertMany(
    assignments: Partial<Record<ActionType, string>>
  ): Promise<void> {
    const t = this.db.transaction("assignments", "readwrite");
    const store = t.objectStore("assignments");
    for (const [actionType, profileId] of Object.entries(assignments)) {
      if (profileId !== undefined) {
        store.put({
          actionType: actionType as ActionType,
          profileId,
        } satisfies AssignmentRecord);
      }
    }
    await tx(t);
  }

  async delete(actionType: ActionType): Promise<void> {
    const store = this.db
      .transaction("assignments", "readwrite")
      .objectStore("assignments");
    await req(store.delete(actionType));
  }

  async deleteMany(actionTypes: ActionType[]): Promise<void> {
    const t = this.db.transaction("assignments", "readwrite");
    const store = t.objectStore("assignments");
    for (const actionType of actionTypes) {
      store.delete(actionType);
    }
    await tx(t);
  }
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const DEEP_MODE_KEY = "deepMode";

class IDBPreferences implements PreferencesStorage {
  constructor(private db: IDBDatabase) {}

  private async readKey<T>(key: string): Promise<T | null> {
    const store = this.db
      .transaction("preferences", "readonly")
      .objectStore("preferences");
    const record: { key: string; value: T } | undefined = await req(
      store.get(key)
    );
    return record?.value ?? null;
  }

  private async putKey<T>(key: string, value: T, mustExist: boolean): Promise<void> {
    const t = this.db.transaction("preferences", "readwrite");
    const store = t.objectStore("preferences");
    const existing = await req(store.get(key));
    if (mustExist && !existing) {
      throw new Error(`Preference ${key} not set`);
    }
    if (!mustExist && existing) {
      throw new Error(`Preference ${key} already set`);
    }
    store.put({ key, value });
    await tx(t);
  }

  createDeepMode(value: boolean): Promise<void> {
    return this.putKey(DEEP_MODE_KEY, value, false);
  }

  readDeepMode(): Promise<boolean | null> {
    return this.readKey<boolean>(DEEP_MODE_KEY);
  }

  updateDeepMode(value: boolean): Promise<void> {
    return this.putKey(DEEP_MODE_KEY, value, true);
  }

  async upsertDeepMode(value: boolean): Promise<void> {
    const t = this.db.transaction("preferences", "readwrite");
    t.objectStore("preferences").put({ key: DEEP_MODE_KEY, value });
    await tx(t);
  }

  async deleteDeepMode(): Promise<void> {
    const store = this.db
      .transaction("preferences", "readwrite")
      .objectStore("preferences");
    await req(store.delete(DEEP_MODE_KEY));
  }
}

// ---------------------------------------------------------------------------
// MCP Servers
// ---------------------------------------------------------------------------

interface McpServerRecord {
  name: string;
  config: McpServerConfig;
}

class IDBMcpServers implements McpServersStorage {
  constructor(private db: IDBDatabase) {}

  async create(name: string, config: McpServerConfig): Promise<void> {
    const t = this.db.transaction("mcpServers", "readwrite");
    const store = t.objectStore("mcpServers");
    const existing = await req(store.get(name));
    if (existing) throw new Error(`MCP server ${name} already exists`);
    store.add({ name, config } satisfies McpServerRecord);
    await tx(t);
  }

  async readByName(name: string): Promise<McpServerConfig | null> {
    const store = this.db
      .transaction("mcpServers", "readonly")
      .objectStore("mcpServers");
    const record: McpServerRecord | undefined = await req(store.get(name));
    return record?.config ?? null;
  }

  async readAll(): Promise<Record<string, McpServerConfig>> {
    const store = this.db
      .transaction("mcpServers", "readonly")
      .objectStore("mcpServers");
    const all: McpServerRecord[] = await req(store.getAll());
    const result: Record<string, McpServerConfig> = {};
    for (const r of all) result[r.name] = r.config;
    return result;
  }

  async update(name: string, config: McpServerConfig): Promise<void> {
    const t = this.db.transaction("mcpServers", "readwrite");
    const store = t.objectStore("mcpServers");
    const existing = await req(store.get(name));
    if (!existing) throw new Error(`MCP server ${name} not found`);
    store.put({ name, config } satisfies McpServerRecord);
    await tx(t);
  }

  async replaceAll(servers: Record<string, McpServerConfig>): Promise<void> {
    const t = this.db.transaction("mcpServers", "readwrite");
    const store = t.objectStore("mcpServers");
    store.clear();
    for (const [name, config] of Object.entries(servers)) {
      store.add({ name, config } satisfies McpServerRecord);
    }
    await tx(t);
  }

  async delete(name: string): Promise<void> {
    const store = this.db
      .transaction("mcpServers", "readwrite")
      .objectStore("mcpServers");
    await req(store.delete(name));
  }
}

// ---------------------------------------------------------------------------
// Tool Prefs
// ---------------------------------------------------------------------------

const DISABLED_KEY = "disabled";
const ALLOW_ALWAYS_KEY = "allowAlways";

class IDBToolPrefs implements ToolPrefsStorage {
  constructor(private db: IDBDatabase) {}

  private async readKey<T>(key: string): Promise<T | null> {
    const store = this.db
      .transaction("toolPrefs", "readonly")
      .objectStore("toolPrefs");
    const record: { key: string; value: T } | undefined = await req(
      store.get(key)
    );
    return record?.value ?? null;
  }

  private async putKey<T>(key: string, value: T, mustExist: boolean): Promise<void> {
    const t = this.db.transaction("toolPrefs", "readwrite");
    const store = t.objectStore("toolPrefs");
    const existing = await req(store.get(key));
    if (mustExist && !existing) {
      throw new Error(`Tool pref ${key} not set`);
    }
    if (!mustExist && existing) {
      throw new Error(`Tool pref ${key} already set`);
    }
    store.put({ key, value });
    await tx(t);
  }

  private async upsertKey<T>(key: string, value: T): Promise<void> {
    const t = this.db.transaction("toolPrefs", "readwrite");
    t.objectStore("toolPrefs").put({ key, value });
    await tx(t);
  }

  private async deleteKey(key: string): Promise<void> {
    const store = this.db
      .transaction("toolPrefs", "readwrite")
      .objectStore("toolPrefs");
    await req(store.delete(key));
  }

  createDisabled(disabled: Record<string, string[]>): Promise<void> {
    return this.putKey(DISABLED_KEY, disabled, false);
  }

  async readDisabled(): Promise<Record<string, string[]>> {
    return (await this.readKey<Record<string, string[]>>(DISABLED_KEY)) ?? {};
  }

  updateDisabled(disabled: Record<string, string[]>): Promise<void> {
    return this.putKey(DISABLED_KEY, disabled, true);
  }

  upsertDisabled(disabled: Record<string, string[]>): Promise<void> {
    return this.upsertKey(DISABLED_KEY, disabled);
  }

  deleteDisabled(): Promise<void> {
    return this.deleteKey(DISABLED_KEY);
  }

  createAllowAlways(tokens: string[]): Promise<void> {
    return this.putKey(ALLOW_ALWAYS_KEY, tokens, false);
  }

  async readAllowAlways(): Promise<string[]> {
    return (await this.readKey<string[]>(ALLOW_ALWAYS_KEY)) ?? [];
  }

  updateAllowAlways(tokens: string[]): Promise<void> {
    return this.putKey(ALLOW_ALWAYS_KEY, tokens, true);
  }

  upsertAllowAlways(tokens: string[]): Promise<void> {
    return this.upsertKey(ALLOW_ALWAYS_KEY, tokens);
  }

  deleteAllowAlways(): Promise<void> {
    return this.deleteKey(ALLOW_ALWAYS_KEY);
  }
}

// ---------------------------------------------------------------------------
// Web Search
// ---------------------------------------------------------------------------

const WEB_SEARCH_KEY = "config";

class IDBWebSearch implements WebSearchStorage {
  constructor(private db: IDBDatabase) {}

  async create(config: WebSearchConfig): Promise<void> {
    const t = this.db.transaction("webSearch", "readwrite");
    const store = t.objectStore("webSearch");
    const existing = await req(store.get(WEB_SEARCH_KEY));
    if (existing) throw new Error("Web-search config already set");
    store.add({ key: WEB_SEARCH_KEY, value: config });
    await tx(t);
  }

  async read(): Promise<WebSearchConfig | null> {
    const store = this.db
      .transaction("webSearch", "readonly")
      .objectStore("webSearch");
    const record: { key: string; value: WebSearchConfig } | undefined = await req(
      store.get(WEB_SEARCH_KEY)
    );
    return record?.value ?? null;
  }

  async update(config: WebSearchConfig): Promise<void> {
    const t = this.db.transaction("webSearch", "readwrite");
    const store = t.objectStore("webSearch");
    const existing = await req(store.get(WEB_SEARCH_KEY));
    if (!existing) throw new Error("Web-search config not set");
    store.put({ key: WEB_SEARCH_KEY, value: config });
    await tx(t);
  }

  async upsert(config: WebSearchConfig): Promise<void> {
    const t = this.db.transaction("webSearch", "readwrite");
    t.objectStore("webSearch").put({ key: WEB_SEARCH_KEY, value: config });
    await tx(t);
  }

  async delete(): Promise<void> {
    const store = this.db
      .transaction("webSearch", "readwrite")
      .objectStore("webSearch");
    await req(store.delete(WEB_SEARCH_KEY));
  }
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

class IDBAttachments implements AttachmentsStorage {
  constructor(private db: IDBDatabase) {}

  async create(
    input: Omit<Attachment, "id" | "createdAt">
  ): Promise<Attachment> {
    const stored: Attachment = {
      ...input,
      id: uuid(),
      createdAt: Date.now(),
    };
    const store = this.db
      .transaction("attachments", "readwrite")
      .objectStore("attachments");
    await req(store.add(stored));
    return stored;
  }

  async readById(id: string): Promise<Attachment | null> {
    const store = this.db
      .transaction("attachments", "readonly")
      .objectStore("attachments");
    return (await req(store.get(id))) ?? null;
  }

  async readManyByIds(ids: string[]): Promise<(Attachment | null)[]> {
    if (ids.length === 0) return [];
    const store = this.db
      .transaction("attachments", "readonly")
      .objectStore("attachments");
    return Promise.all(
      ids.map(async (id) => (await req(store.get(id))) ?? null)
    );
  }

  async update(id: string, patch: Partial<Attachment>): Promise<void> {
    const t = this.db.transaction("attachments", "readwrite");
    const store = t.objectStore("attachments");
    const existing: Attachment | undefined = await req(store.get(id));
    if (existing) {
      // Preserve identity fields — `id` and `createdAt` cannot be patched.
      store.put({
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
      });
    }
    await tx(t);
  }

  async delete(id: string): Promise<void> {
    const store = this.db
      .transaction("attachments", "readwrite")
      .objectStore("attachments");
    await req(store.delete(id));
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const t = this.db.transaction("attachments", "readwrite");
    const store = t.objectStore("attachments");
    for (const id of ids) store.delete(id);
    await tx(t);
  }

  deleteByMessage(messageId: string): Promise<void> {
    return deleteAttachmentsByMessage(this.db, messageId);
  }

  deleteByThread(threadId: string): Promise<void> {
    return deleteAttachmentsByThread(this.db, threadId);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createStorage(
  dbName = "ai-chat-sample"
): Promise<StorageAdapter> {
  const db = await openDatabase(dbName);

  return {
    threads: new IDBThreads(db),
    messages: new IDBMessages(db),
    profiles: new IDBProfiles(db),
    prompts: new IDBPrompts(db),
    promptFolders: new IDBPromptFolders(db),
    assignments: new IDBAssignments(db),
    preferences: new IDBPreferences(db),
    mcpServers: new IDBMcpServers(db),
    toolPrefs: new IDBToolPrefs(db),
    webSearch: new IDBWebSearch(db),
    attachments: new IDBAttachments(db),
    async init() {
      /* DB already opened */
    },
    async close() {
      /* keep connection alive for re-mounts */
    },
  };
}
