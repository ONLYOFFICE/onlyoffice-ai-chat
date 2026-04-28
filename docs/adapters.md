# Adapters

The widget never imports a concrete persistence engine, settings
backend, or platform capability. Three adapter interfaces are
host-supplied, and each is consumed via React context (or directly
when running headless).

| Adapter | Source of truth |
| --- | --- |
| [`SettingsAdapter`](#settingsadapter) | [`src/shared/settings-adapter.ts`](../src/shared/settings-adapter.ts) |
| [`StorageAdapter`](#storageadapter) | [`src/core/storage/adapter.ts`](../src/core/storage/adapter.ts) |
| [`PlatformAdapter`](#platformadapter) | [`src/ui/platform/types.ts`](../src/ui/platform/types.ts) |

## `SettingsAdapter`

A synchronous key-value store for tiny scalars (auto-allow tools,
session-only flags). If your backend is async, pre-load values at
startup and serve from an in-memory cache.

```ts
interface SettingsAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

### `localStorage` example

```ts
import type { SettingsAdapter } from "@onlyoffice/ai-chat";

const settings: SettingsAdapter = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
  remove: (k) => localStorage.removeItem(k),
};
```

### Namespaced wrapper

```ts
function namespaced(prefix: string): SettingsAdapter {
  return {
    get: (k) => localStorage.getItem(`${prefix}.${k}`),
    set: (k, v) => localStorage.setItem(`${prefix}.${k}`, v),
    remove: (k) => localStorage.removeItem(`${prefix}.${k}`),
  };
}
```

## `StorageAdapter`

Aggregates ten domain-specific sub-storages plus lifecycle methods.
All data methods are `Promise`-based so any backend (IndexedDB,
SQLite, REST) plugs in identically.

```ts
interface StorageAdapter {
  threads:        ThreadsStorage;
  messages:       MessagesStorage;
  profiles:       ProfilesStorage;
  prompts:        PromptsStorage;
  promptFolders:  PromptFoldersStorage;
  assignments:    AssignmentsStorage;
  preferences:    PreferencesStorage;
  mcpServers:     McpServersStorage;
  toolPrefs:      ToolPrefsStorage;
  webSearch:      WebSearchStorage;

  init():  Promise<void>;
  close(): Promise<void>;
}
```

| Sub-storage | Holds |
| --- | --- |
| `threads` | Chat sessions |
| `messages` | Messages scoped to a thread |
| `profiles` | AI provider profiles (key + model + capabilities) |
| `prompts` | Reusable prompt templates |
| `promptFolders` | One-level grouping for prompts (cascading delete) |
| `assignments` | `ActionType → profileId` bindings |
| `preferences` | Scalar prefs (e.g. extended-thinking flag) |
| `mcpServers` | Custom MCP server transport config |
| `toolPrefs` | Per-tool disabled / auto-approve flags |
| `webSearch` | Singleton web-search provider config |

`init()` runs once before any other method (open DB, run
migrations). `close()` runs on widget unmount.

The full method signatures live in
[`src/core/storage/`](../src/core/storage/) — every file is a
single sub-interface (e.g. `threads.ts`, `messages.ts`,
`assignments.ts`).

For a complete IndexedDB implementation pattern, see
[`core/storage/README.md`](./core/storage/README.md).

## `PlatformAdapter`

Bundles every host-specific capability into one injectable object.
Each sub-adapter is **nullable** — set it to `null` when the host
does not support the capability and the widget hides the related
UI automatically.

```ts
interface PlatformAdapter {
  file:        PlatformFileOperations | null;
  process:     PlatformProcessRunner | null;
  hostTools:   PlatformHostTools | null;
  clouds:      PlatformClouds | null;
  env:         PlatformEnvironment;
  fetchProxy?: (url: string, init?: RequestInit) => Promise<Response>;
}
```

### `PlatformFileOperations`

File picking, conversion, save-as, open-in-editor.

```ts
interface PlatformFileOperations {
  pickFiles():  Promise<{ path: string; name: string }[] | null>;
  pickImage():  Promise<{ name: string; base64: string } | null>;
  convertFileToText(path: string, format: number): Promise<string>;
  getFileType(path: string):                       number;
  getRecentFiles():                                Promise<string>;
  saveAsFile(content: string, defaultName: string): Promise<void>;
  openFile(path: string, name: string):             void;
}
```

`null` → attachment button and "Save as" options are hidden.

### `PlatformProcessRunner`

Spawns child processes for the MCP STDIO transport.

```ts
interface PlatformProcessRunner {
  createProcess(command: string, env?: Record<string, string>): TProcess | null;
  isAvailable(): boolean;
}
```

`null` → only HTTP MCP servers are available.

### `PlatformEnvironment`

Theme + locale + DPR. The widget reads at startup and, if
`onEnvironmentChange` is provided, subscribes to live updates.

```ts
interface PlatformEnvironment {
  theme:            string;
  systemTheme:      "dark" | "light";
  locale:           string;
  devicePixelRatio: number;
  onEnvironmentChange?: (
    callback: (info: { theme?: string; lang?: string }) => void,
  ) => () => void;
}
```

### `PlatformClouds`

Cloud account integration (e.g. ONLYOFFICE DocSpace portals).

```ts
interface PlatformClouds {
  getClouds():     Promise<TCloud[]>;
  getCloudKeys():  TCloudKey[];
  onCloudsChange?(callback: () => void): () => void;
}
```

`null` → cloud-account features are unavailable.

### `PlatformHostTools`

Built-in tools exposed by the embedding application (e.g. editor
commands). Appear alongside MCP and web-search tools in the unified
list.

```ts
interface PlatformHostTools {
  getTools(): TMCPItem[];
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}
```

`null` → no host-tool section in the tools list.

### `fetchProxy`

Optional fetch wrapper used by the library for provider HTTP calls.
Useful behind a CORS proxy.

```ts
const platform: PlatformAdapter = {
  // ...
  fetchProxy: async (url, init) =>
    fetch(`/api/proxy?url=${encodeURIComponent(url)}`, init),
};
```

### Browser-only example with environment sync

```ts
const platform: PlatformAdapter = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: "theme-light",
    systemTheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    locale: navigator.language.split("-")[0] || "en",
    devicePixelRatio: window.devicePixelRatio,
    onEnvironmentChange(cb) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = (e: MediaQueryListEvent) =>
        cb({ theme: e.matches ? "theme-dark" : "theme-light" });
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
  },
};
```
