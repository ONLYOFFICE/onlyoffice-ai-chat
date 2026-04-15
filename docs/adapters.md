# Adapters

The library uses three adapter interfaces injected via React context.
No concrete implementations are imported directly -- swap any adapter
without touching library internals.

---

## SettingsAdapter

A synchronous key-value store for small settings (profile selections, feature
flags, MCP server configs). If the host storage is async, pre-load values
during initialization and serve from an in-memory cache.

### Interface

```ts
interface SettingsAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

### Full localStorage Implementation

```ts
import type { SettingsAdapter } from "@onlyoffice/ai-chat";

const localStorageSettings: SettingsAdapter = {
  get(key) {
    return localStorage.getItem(key);
  },
  set(key, value) {
    localStorage.setItem(key, value);
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};
```

### Alternative: Namespaced Adapter

```ts
function createNamespacedSettings(prefix: string): SettingsAdapter {
  return {
    get(key) {
      return localStorage.getItem(`${prefix}.${key}`);
    },
    set(key, value) {
      localStorage.setItem(`${prefix}.${key}`, value);
    },
    remove(key) {
      localStorage.removeItem(`${prefix}.${key}`);
    },
  };
}

const settings = createNamespacedSettings("myApp");
```

---

## StorageAdapter

Aggregates five domain-specific sub-storages plus lifecycle methods. All
data methods are async (`Promise`-based) to support IndexedDB, REST APIs,
SQLite, etc.

### Interface Overview

```ts
interface StorageAdapter {
  threads: ThreadsStorage;
  messages: MessagesStorage;
  profiles: ProfilesStorage;
  prompts: PromptsStorage;
  promptFolders: PromptFoldersStorage;

  init(): Promise<void>;
  close(): Promise<void>;
}
```

### Lifecycle

- **`init()`** -- Called once on startup before any storage method is
  invoked. Open database connections, run migrations, create tables here.
- **`close()`** -- Called when the widget unmounts. Close connections and
  flush pending writes.

### Sub-Storage: ThreadsStorage

Manages chat sessions (conversations).

```ts
interface ThreadsStorage {
  create(threadId: string, title: string, provider?: TProvider,
         model?: Model, profileId?: string): Promise<void>;
  getAll(): Promise<Thread[]>;            // sorted by lastEditDate desc
  getById(threadId: string): Promise<Thread | null>;
  update(threadId: string, title?: string): Promise<void>;
  touch(threadId: string, updates?: {
    provider?: TProvider | null;
    model?: Model | null;
    profileId?: string | null;
  }): Promise<void>;
  delete(threadId: string): Promise<void>; // cascading delete
}
```

### Sub-Storage: MessagesStorage

Individual chat messages scoped to a thread.

```ts
interface MessagesStorage {
  create(threadId: string, id: string,
         message: ThreadMessageLike): Promise<void>;
  getByThread(threadId: string,
              limit?: number): Promise<ThreadMessageLike[]>;
  getById(threadId: string,
          messageId: string): Promise<ThreadMessageLike | null>;
  update(messageId: string, message: ThreadMessageLike): Promise<void>;
  delete(messageId: string): Promise<void>;
  deleteByThread(threadId: string): Promise<void>;
  replaceByThread(threadId: string,
                  messages: ThreadMessageLike[]): Promise<void>;
  search(query: string): Promise<{
    threadId: string;
    message: ThreadMessageLike;
  }[]>;
}
```

### Sub-Storage: ProfilesStorage

AI provider profiles (API key + model + capabilities).

```ts
interface ProfilesStorage {
  create(profile: Profile): Promise<void>;
  createMany(profiles: Profile[]): Promise<void>;
  getAll(): Promise<Profile[]>;
  getById(id: string): Promise<Profile | undefined>;
  update(profile: Profile): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Sub-Storage: PromptsStorage

Reusable prompt templates, optionally organized in folders.

```ts
interface PromptsStorage {
  create(prompt: Prompt): Promise<void>;
  getAll(): Promise<Prompt[]>;
  getById(id: string): Promise<Prompt | null>;
  update(id: string, updates: {
    name?: string;
    text?: string;
    folderId?: string | null;
  }): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByFolder(folderId: string): Promise<void>;
}
```

### Sub-Storage: PromptFoldersStorage

One-level grouping for prompts. Deleting a folder cascades to its prompts.

```ts
interface PromptFoldersStorage {
  create(folder: PromptFolder): Promise<void>;
  getAll(): Promise<PromptFolder[]>;
  getById(id: string): Promise<PromptFolder | null>;
  update(id: string, name: string): Promise<void>;
  delete(id: string): Promise<void>;  // cascading
}
```

### Example: IndexedDB Sketch

```ts
import type { StorageAdapter, ThreadsStorage } from "@onlyoffice/ai-chat";

class IDBThreadsStorage implements ThreadsStorage {
  private db!: IDBDatabase;
  private storeName = "threads";

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async create(threadId: string, title: string) {
    const tx = this.db.transaction(this.storeName, "readwrite");
    tx.objectStore(this.storeName).add({
      threadId,
      title,
      lastEditDate: Date.now(),
    });
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll() {
    // Use an index on lastEditDate for sorted retrieval
    const tx = this.db.transaction(this.storeName, "readonly");
    const store = tx.objectStore(this.storeName);
    return new Promise<Thread[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const threads = req.result as Thread[];
        threads.sort((a, b) => (b.lastEditDate ?? 0) - (a.lastEditDate ?? 0));
        resolve(threads);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ... implement remaining methods similarly
}

async function createIDBStorage(): Promise<StorageAdapter> {
  const db = await openDatabase("ai-chat", 1, (db) => {
    db.createObjectStore("threads", { keyPath: "threadId" });
    db.createObjectStore("messages", { keyPath: "id" });
    db.createObjectStore("profiles", { keyPath: "id" });
    db.createObjectStore("prompts", { keyPath: "id" });
    db.createObjectStore("promptFolders", { keyPath: "id" });
  });

  return {
    threads: new IDBThreadsStorage(db),
    messages: new IDBMessagesStorage(db),
    profiles: new IDBProfilesStorage(db),
    prompts: new IDBPromptsStorage(db),
    promptFolders: new IDBPromptFoldersStorage(db),
    async init() { /* DB already opened */ },
    async close() { db.close(); },
  };
}
```

---

## PlatformAdapter

Bundles every host-specific capability into a single injectable dependency.
Each sub-adapter is **nullable** -- set it to `null` when the host does not
support that capability, and the library hides the corresponding UI.

### Interface

```ts
interface PlatformAdapter {
  file: PlatformFileOperations | null;
  process: PlatformProcessRunner | null;
  env: PlatformEnvironment;
  hostTools: PlatformHostTools | null;
  clouds: PlatformClouds | null;
  fetchProxy?: (url: string, init?: RequestInit) => Promise<Response>;
}
```

### Sub-Interface: PlatformFileOperations

File picking, conversion, and opening through the host editor.

```ts
interface PlatformFileOperations {
  pickFiles(): Promise<{ path: string; name: string }[] | null>;
  pickImage(): Promise<{ name: string; base64: string } | null>;
  convertFileToText(path: string, format: number): Promise<string>;
  getFileType(path: string): number;
  getRecentFiles(): Promise<string>;
  saveAsFile(content: string, defaultName: string): Promise<void>;
  openFile(path: string, name: string): void;
}
```

When `file` is `null`, the attachment button and "Save as" options are hidden.

### Sub-Interface: PlatformProcessRunner

Spawns child processes for MCP STDIO server transport.

```ts
interface PlatformProcessRunner {
  createProcess(command: string,
                env?: Record<string, string>): TProcess | null;
  isAvailable(): boolean;
}
```

When `process` is `null`, only HTTP-based MCP servers are available.

### Sub-Interface: PlatformEnvironment

Host environment info. The library reads these at startup and optionally
subscribes to live updates.

```ts
interface PlatformEnvironment {
  theme: string;
  systemTheme: "dark" | "light";
  locale: string;
  devicePixelRatio: number;
  onEnvironmentChange?: (
    callback: (info: { theme?: string; lang?: string }) => void,
  ) => () => void;
}
```

### Sub-Interface: PlatformClouds

Cloud account integration (e.g., ONLYOFFICE DocSpace portals).

```ts
interface PlatformClouds {
  getClouds(): Promise<TCloud[]>;
  getCloudKeys(): TCloudKey[];
  onCloudsChange?(callback: () => void): () => void;
}
```

### Sub-Interface: PlatformHostTools

Built-in tools exposed by the host application (e.g., editor commands).

```ts
interface PlatformHostTools {
  getTools(): TMCPItem[];
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}
```

### Null Pattern for Optional Features

The recommended approach is to set unused sub-adapters to `null`:

```ts
const platform: PlatformAdapter = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: "light",
    systemTheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    locale: navigator.language.split("-")[0] || "en",
    devicePixelRatio: window.devicePixelRatio,
  },
};
```

### Minimal Browser Implementation with Environment Sync

```ts
const platform: PlatformAdapter = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: "light",
    systemTheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    locale: navigator.language.split("-")[0] || "en",
    devicePixelRatio: window.devicePixelRatio,
    onEnvironmentChange(callback) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        callback({ theme: e.matches ? "dark" : "light" });
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    },
  },
};
```

### fetchProxy

Optional fetch wrapper for proxied HTTP requests (e.g., CORS proxy). When
set, the library uses it instead of the global `fetch` for provider API
calls:

```ts
const platform: PlatformAdapter = {
  // ...other fields...
  fetchProxy: async (url, init) => {
    return fetch(`/api/proxy?url=${encodeURIComponent(url)}`, init);
  },
};
```
