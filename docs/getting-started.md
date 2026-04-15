# Getting Started

## Installation

```bash
# npm
npm install @onlyoffice/ai-chat

# yarn
yarn add @onlyoffice/ai-chat

# pnpm
pnpm add @onlyoffice/ai-chat
```

### Peer Dependencies

React 18 or 19 is required:

```bash
npm install react react-dom
```

---

## Minimal Setup

Four things are needed to render the widget:

1. A **SettingsAdapter** (key-value store for settings)
2. A **StorageAdapter** (persistent store for threads, messages, profiles, prompts)
3. A **PlatformAdapter** (host environment capabilities)
4. A **StoreKeys** object (maps logical setting names to storage key strings)

### 1. SettingsAdapter (localStorage)

```ts
import type { SettingsAdapter } from "@onlyoffice/ai-chat";

const settings: SettingsAdapter = {
  get(key: string): string | null {
    return localStorage.getItem(key);
  },
  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
};
```

### 2. StorageAdapter (in-memory stub)

For a quick prototype, store everything in memory. For production, use
IndexedDB (see [docs/adapters.md](./adapters.md) for a full example).

```ts
import type {
  StorageAdapter,
  ThreadsStorage,
  MessagesStorage,
  ProfilesStorage,
  PromptsStorage,
  PromptFoldersStorage,
} from "@onlyoffice/ai-chat";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Thread, Profile, Prompt, PromptFolder } from "@onlyoffice/ai-chat";

// --- Threads ---
class InMemoryThreads implements ThreadsStorage {
  private threads: Thread[] = [];

  async create(threadId: string, title: string) {
    this.threads.push({ threadId, title, lastEditDate: Date.now() });
  }
  async getAll() {
    return [...this.threads].sort(
      (a, b) => (b.lastEditDate ?? 0) - (a.lastEditDate ?? 0),
    );
  }
  async getById(id: string) {
    return this.threads.find((t) => t.threadId === id) ?? null;
  }
  async update(id: string, title?: string) {
    const t = this.threads.find((th) => th.threadId === id);
    if (t) {
      if (title !== undefined) t.title = title;
      t.lastEditDate = Date.now();
    }
  }
  async touch(id: string) {
    const t = this.threads.find((th) => th.threadId === id);
    if (t) t.lastEditDate = Date.now();
  }
  async delete(id: string) {
    this.threads = this.threads.filter((t) => t.threadId !== id);
  }
}

// --- Messages ---
class InMemoryMessages implements MessagesStorage {
  private messages: Map<string, { id: string; threadId: string; msg: ThreadMessageLike }[]> = new Map();

  async create(threadId: string, id: string, message: ThreadMessageLike) {
    if (!this.messages.has(threadId)) this.messages.set(threadId, []);
    this.messages.get(threadId)!.push({ id, threadId, msg: message });
  }
  async getByThread(threadId: string, limit?: number) {
    const msgs = this.messages.get(threadId) ?? [];
    const slice = limit ? msgs.slice(-limit) : msgs;
    return slice.map((m) => m.msg);
  }
  async getById(threadId: string, messageId: string) {
    const msgs = this.messages.get(threadId) ?? [];
    return msgs.find((m) => m.id === messageId)?.msg ?? null;
  }
  async update(messageId: string, message: ThreadMessageLike) {
    for (const msgs of this.messages.values()) {
      const found = msgs.find((m) => m.id === messageId);
      if (found) { found.msg = message; return; }
    }
  }
  async delete(messageId: string) {
    for (const [tid, msgs] of this.messages) {
      this.messages.set(tid, msgs.filter((m) => m.id !== messageId));
    }
  }
  async deleteByThread(threadId: string) {
    this.messages.delete(threadId);
  }
  async replaceByThread(threadId: string, messages: ThreadMessageLike[]) {
    this.messages.set(threadId, messages.map((msg, i) => ({
      id: String(i),
      threadId,
      msg,
    })));
  }
  async search(query: string) {
    const results: { threadId: string; message: ThreadMessageLike }[] = [];
    for (const [threadId, msgs] of this.messages) {
      for (const m of msgs) {
        if (JSON.stringify(m.msg).toLowerCase().includes(query.toLowerCase())) {
          results.push({ threadId, message: m.msg });
        }
      }
    }
    return results;
  }
}

// --- Profiles (similar pattern) ---
class InMemoryProfiles implements ProfilesStorage {
  private profiles: Profile[] = [];
  async create(p: Profile) { this.profiles.push(p); }
  async createMany(ps: Profile[]) { this.profiles.push(...ps); }
  async getAll() { return this.profiles; }
  async getById(id: string) { return this.profiles.find((p) => p.id === id); }
  async update(p: Profile) {
    const i = this.profiles.findIndex((x) => x.id === p.id);
    if (i >= 0) this.profiles[i] = p;
  }
  async delete(id: string) {
    this.profiles = this.profiles.filter((p) => p.id !== id);
  }
}

// --- Prompts & Folders (stubs) ---
class InMemoryPrompts implements PromptsStorage {
  private prompts: Prompt[] = [];
  async create(p: Prompt) { this.prompts.push(p); }
  async getAll() { return this.prompts; }
  async getById(id: string) { return this.prompts.find((p) => p.id === id) ?? null; }
  async update(id: string, updates: { name?: string; text?: string; folderId?: string | null }) {
    const p = this.prompts.find((x) => x.id === id);
    if (p) Object.assign(p, updates, { updatedAt: Date.now() });
  }
  async delete(id: string) { this.prompts = this.prompts.filter((p) => p.id !== id); }
  async deleteByFolder(folderId: string) {
    this.prompts = this.prompts.filter((p) => p.folderId !== folderId);
  }
}

class InMemoryPromptFolders implements PromptFoldersStorage {
  private folders: PromptFolder[] = [];
  async create(f: PromptFolder) { this.folders.push(f); }
  async getAll() { return this.folders; }
  async getById(id: string) { return this.folders.find((f) => f.id === id) ?? null; }
  async update(id: string, name: string) {
    const f = this.folders.find((x) => x.id === id);
    if (f) { f.name = name; f.updatedAt = Date.now(); }
  }
  async delete(id: string) { this.folders = this.folders.filter((f) => f.id !== id); }
}

// --- Assemble ---
const storage: StorageAdapter = {
  threads: new InMemoryThreads(),
  messages: new InMemoryMessages(),
  profiles: new InMemoryProfiles(),
  prompts: new InMemoryPrompts(),
  promptFolders: new InMemoryPromptFolders(),
  async init() { /* open DB connections here in production */ },
  async close() { /* close DB connections here in production */ },
};
```

### 3. PlatformAdapter (browser defaults)

Set sub-adapters to `null` when the capability is unavailable:

```ts
import type { PlatformAdapter } from "@onlyoffice/ai-chat";

const platform: PlatformAdapter = {
  file: null,           // no native file picker
  process: null,        // no child process spawning (browser)
  hostTools: null,      // no built-in host tools
  clouds: null,         // no cloud account integration
  env: {
    theme: "light",
    systemTheme: "light",
    locale: navigator.language.split("-")[0] || "en",
    devicePixelRatio: window.devicePixelRatio,
  },
};
```

### 4. StoreKeys

Maps logical setting names to storage key strings. Namespace them to avoid
collisions with other libraries:

```ts
import type { StoreKeys } from "@onlyoffice/ai-chat";

const storeKeys: StoreKeys = {
  defaultProfile: "ai-chat.defaultProfile",
  chatProfile: "ai-chat.chatProfile",
  summarizationProfile: "ai-chat.summarizationProfile",
  translationProfile: "ai-chat.translationProfile",
  textAnalysisProfile: "ai-chat.textAnalysisProfile",
  imageGenerationProfile: "ai-chat.imageGenerationProfile",
  ocrProfile: "ai-chat.ocrProfile",
  visionProfile: "ai-chat.visionProfile",
  deepMode: "ai-chat.deepMode",
  mcpServers: "ai-chat.mcpServers",
  disabledTools: "ai-chat.disabledTools",
};
```

---

## Rendering the Widget

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";

// Import the base styles (required)
import "@onlyoffice/ai-chat/styles";

// Optionally import built-in themes
import "@onlyoffice/ai-chat/styles/themes";

function App() {
  return (
    <AIChatWidget
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={storeKeys}
      locale="en"
      theme="light"
    />
  );
}
```

---

## Framework-Specific Notes

### Vite

CSS imports work out of the box. No additional configuration needed:

```ts
import "@onlyoffice/ai-chat/styles";
```

### Next.js (App Router)

Import styles in a **client component** or in your root `layout.tsx`:

```tsx
// app/layout.tsx
import "@onlyoffice/ai-chat/styles";
import "@onlyoffice/ai-chat/styles/themes";
```

Since `AIChatWidget` uses browser-only APIs (localStorage, IndexedDB,
`window`), wrap it in a client boundary:

```tsx
"use client";

import { AIChatWidget } from "@onlyoffice/ai-chat";
import "@onlyoffice/ai-chat/styles";

export default function ChatPage() {
  // Create adapters here ...
  return (
    <AIChatWidget
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={storeKeys}
    />
  );
}
```

### Next.js (Pages Router)

Import styles in `_app.tsx`:

```tsx
// pages/_app.tsx
import "@onlyoffice/ai-chat/styles";
import type { AppProps } from "next/app";

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

---

## Next Steps

- **[Adapters deep dive](./adapters.md)** -- full interface reference for
  SettingsAdapter, StorageAdapter, and PlatformAdapter.
- **[Headless usage](./headless-usage.md)** -- use stores, services, and
  pages without the `AIChatWidget` wrapper.
- **[Architecture](./architecture.md)** -- understand the adapter pattern,
  provider system, tool pipeline, and data flow.
