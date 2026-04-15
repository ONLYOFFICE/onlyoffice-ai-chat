import type {
  StorageAdapter,
  ThreadsStorage,
  MessagesStorage,
  ProfilesStorage,
  PromptsStorage,
  PromptFoldersStorage,
} from "@onlyoffice/ai-chat";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  Thread,
  Profile,
  Prompt,
  PromptFolder,
  TProvider,
  Model,
} from "@onlyoffice/ai-chat";

const DB_NAME = "ai-chat-sample";
const DB_VERSION = 1;

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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      const threads = db.createObjectStore("threads", {
        keyPath: "threadId",
      });
      threads.createIndex("lastEditDate", "lastEditDate");

      const messages = db.createObjectStore("messages", { keyPath: "id" });
      messages.createIndex("threadId", "threadId");

      db.createObjectStore("profiles", { keyPath: "id" });

      const prompts = db.createObjectStore("prompts", { keyPath: "id" });
      prompts.createIndex("folderId", "folderId");

      db.createObjectStore("promptFolders", { keyPath: "id" });
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

  async create(
    threadId: string,
    title: string,
    provider?: TProvider,
    model?: Model,
    profileId?: string
  ): Promise<void> {
    const store = this.db
      .transaction("threads", "readwrite")
      .objectStore("threads");
    await req(
      store.add({
        threadId,
        title,
        lastEditDate: Date.now(),
        provider,
        model,
        profileId,
      })
    );
  }

  async getAll(): Promise<Thread[]> {
    const store = this.db
      .transaction("threads", "readonly")
      .objectStore("threads");
    const all: Thread[] = await req(store.getAll());
    return all.sort((a, b) => (b.lastEditDate ?? 0) - (a.lastEditDate ?? 0));
  }

  async getById(threadId: string): Promise<Thread | null> {
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
      thread.lastEditDate = Date.now();
      store.put(thread);
    }
    await tx(t);
  }

  async touch(
    threadId: string,
    updates?: {
      provider?: TProvider | null;
      model?: Model | null;
      profileId?: string | null;
    }
  ): Promise<void> {
    const t = this.db.transaction("threads", "readwrite");
    const store = t.objectStore("threads");
    const thread: Thread | undefined = await req(store.get(threadId));
    if (thread) {
      thread.lastEditDate = Date.now();
      if (updates) {
        if (updates.provider !== undefined)
          thread.provider = updates.provider ?? undefined;
        if (updates.model !== undefined)
          thread.model = updates.model ?? undefined;
        if (updates.profileId !== undefined)
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
  constructor(private db: IDBDatabase) {}

  async create(
    threadId: string,
    id: string,
    message: ThreadMessageLike
  ): Promise<void> {
    const store = this.db
      .transaction("messages", "readwrite")
      .objectStore("messages");
    const record: MessageRecord = {
      id,
      threadId,
      message,
      timestamp: Date.now(),
    };
    await req(store.add(record));
  }

  async getByThread(
    threadId: string,
    limit?: number
  ): Promise<ThreadMessageLike[]> {
    const store = this.db
      .transaction("messages", "readonly")
      .objectStore("messages");
    const index = store.index("threadId");
    const records: MessageRecord[] = await req(
      index.getAll(IDBKeyRange.only(threadId))
    );
    records.sort((a, b) => a.timestamp - b.timestamp);
    const slice = limit ? records.slice(-limit) : records;
    return slice.map((r) => r.message);
  }

  async getById(
    threadId: string,
    messageId: string
  ): Promise<ThreadMessageLike | null> {
    const store = this.db
      .transaction("messages", "readonly")
      .objectStore("messages");
    const record: MessageRecord | undefined = await req(store.get(messageId));
    if (record && record.threadId === threadId) return record.message;
    return null;
  }

  async update(messageId: string, message: ThreadMessageLike): Promise<void> {
    const t = this.db.transaction("messages", "readwrite");
    const store = t.objectStore("messages");
    const record: MessageRecord | undefined = await req(store.get(messageId));
    if (record) {
      record.message = message;
      record.timestamp = Date.now();
      store.put(record);
    }
    await tx(t);
  }

  async delete(messageId: string): Promise<void> {
    const store = this.db
      .transaction("messages", "readwrite")
      .objectStore("messages");
    await req(store.delete(messageId));
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
  }

  async replaceByThread(
    threadId: string,
    messages: ThreadMessageLike[]
  ): Promise<void> {
    const t = this.db.transaction("messages", "readwrite");
    const store = t.objectStore("messages");
    const index = store.index("threadId");

    const keys: IDBValidKey[] = await req(
      index.getAllKeys(IDBKeyRange.only(threadId))
    );
    for (const key of keys) {
      store.delete(key);
    }

    const now = Date.now();
    messages.forEach((msg, i) => {
      const record: MessageRecord = {
        id: `${threadId}-${i}-${now}`,
        threadId,
        message: msg,
        timestamp: now + i,
      };
      store.add(record);
    });

    await tx(t);
  }

  async search(
    query: string
  ): Promise<{ threadId: string; message: ThreadMessageLike }[]> {
    const store = this.db
      .transaction("messages", "readonly")
      .objectStore("messages");
    const all: MessageRecord[] = await req(store.getAll());
    const lowerQuery = query.toLowerCase();
    return all
      .filter((r) =>
        JSON.stringify(r.message).toLowerCase().includes(lowerQuery)
      )
      .map((r) => ({ threadId: r.threadId, message: r.message }));
  }
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

class IDBProfiles implements ProfilesStorage {
  constructor(private db: IDBDatabase) {}

  async create(profile: Profile): Promise<void> {
    const store = this.db
      .transaction("profiles", "readwrite")
      .objectStore("profiles");
    await req(store.add(profile));
  }

  async createMany(profiles: Profile[]): Promise<void> {
    const t = this.db.transaction("profiles", "readwrite");
    const store = t.objectStore("profiles");
    for (const p of profiles) {
      store.add(p);
    }
    await tx(t);
  }

  async getAll(): Promise<Profile[]> {
    const store = this.db
      .transaction("profiles", "readonly")
      .objectStore("profiles");
    return req(store.getAll());
  }

  async getById(id: string): Promise<Profile | undefined> {
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

  async create(prompt: Prompt): Promise<void> {
    const store = this.db
      .transaction("prompts", "readwrite")
      .objectStore("prompts");
    await req(store.add(prompt));
  }

  async getAll(): Promise<Prompt[]> {
    const store = this.db
      .transaction("prompts", "readonly")
      .objectStore("prompts");
    const all: Prompt[] = await req(store.getAll());
    return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async getById(id: string): Promise<Prompt | null> {
    const store = this.db
      .transaction("prompts", "readonly")
      .objectStore("prompts");
    return (await req(store.get(id))) ?? null;
  }

  async update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ): Promise<void> {
    const t = this.db.transaction("prompts", "readwrite");
    const store = t.objectStore("prompts");
    const prompt: Prompt | undefined = await req(store.get(id));
    if (prompt) {
      Object.assign(prompt, updates, { updatedAt: Date.now() });
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

  async create(folder: PromptFolder): Promise<void> {
    const store = this.db
      .transaction("promptFolders", "readwrite")
      .objectStore("promptFolders");
    await req(store.add(folder));
  }

  async getAll(): Promise<PromptFolder[]> {
    const store = this.db
      .transaction("promptFolders", "readonly")
      .objectStore("promptFolders");
    const all: PromptFolder[] = await req(store.getAll());
    return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async getById(id: string): Promise<PromptFolder | null> {
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
// Factory
// ---------------------------------------------------------------------------

export async function createStorage(): Promise<StorageAdapter> {
  const db = await openDatabase();

  return {
    threads: new IDBThreads(db),
    messages: new IDBMessages(db),
    profiles: new IDBProfiles(db),
    prompts: new IDBPrompts(db),
    promptFolders: new IDBPromptFolders(db),
    async init() {
      /* DB already opened */
    },
    async close() {
      db.close();
    },
  };
}
