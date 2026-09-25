# Adapters

The widget never imports a concrete persistence engine, settings
backend, or platform capability. Four adapter interfaces are
host-supplied, and each is consumed via React context (or directly
when running headless).

| Adapter | Source of truth |
| --- | --- |
| [`SettingsAdapter`](#settingsadapter) | [`src/shared/settings-adapter.ts`](../src/shared/settings-adapter.ts) |
| [`StorageAdapter`](#storageadapter) | [`src/core/storage/adapter.ts`](../src/core/storage/adapter.ts) |
| [`PlatformAdapter`](#platformadapter) | [`src/ui/providers/PlatformProvider/types.ts`](../src/ui/providers/PlatformProvider/types.ts) |
| [`ToolsAdapter`](#toolsadapter) (optional) | [`src/core/tools-adapter.ts`](../src/core/tools-adapter.ts) |

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

Aggregates eleven domain-specific sub-storages plus lifecycle
methods. All data methods are `Promise`-based so any backend
(IndexedDB, SQLite, REST) plugs in identically.

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
  attachments:    AttachmentsStorage;

  getContextFolders?(): Promise<ContextFolder[]>; // optional
  getRoomSkills?(cloud: string, roomId: string): Promise<RoomSkill[]>; // optional

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
| `attachments` | User-message attachments (files + images) |

`threads.readAll` and `messages.readByThread` accept optional
keyset-pagination parameters (`count`, `cursor`, plus `direction` on
messages), used only when the widget runs with `enablePagination` — see
[the storage contract](./core/storage/storage.md) for the exact
semantics. Adapters that ignore them keep working (full-list reads).

`getContextFolders` is optional. It lists the rooms the user can add
to the conversation as context, grouped by cloud account
(`{ cloud: string; rooms: { id: string; name: string }[] }`); the
composer's settings menu lists them (one row per cloud, rooms inside).
`getRoomSkills` is optional too: given a cloud and room id from that
list it returns the room's skills (`{ id: string; name: string }[]`),
shown with per-skill switches once the room is connected. Omit it when the
host has no room concept.

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
  file:           PlatformFileOperations | null;
  process:        PlatformProcessRunner | null;
  hostTools:      PlatformHostTools | null;
  clouds:         PlatformClouds | null;
  env:            PlatformEnvironment;
  fetchProxy?:    (url: string, init?: RequestInit) => Promise<Response>;
  externalFetch?: (url: string, init?: RequestInit) => Promise<Response>;
}
```

### `PlatformFileOperations`

File picking, conversion, save-as, open-in-editor.

```ts
interface ExportFormat {
  id: string; // forwarded to saveAsFile, e.g. "docx", "pdf", "md"
  label: string; // submenu label, e.g. "Word (.docx)"
  extension: string; // file extension, e.g. "docx"
}

interface AttachmentPickFilter {
  id: string; // stable group id, e.g. "documents", "spreadsheets"
  label: string; // English fallback label, e.g. "Text documents"
  extensions: string[]; // lowercase, no leading dot, e.g. ["doc", "docx"]
}

interface PlatformFileOperations {
  pickFiles(filters?: readonly AttachmentPickFilter[]):
    Promise<{ path: string; name: string }[] | null>;
  pickImage():  Promise<{ name: string; base64: string } | null>;
  convertFileToText(path: string, format: number): Promise<string>;
  getFileType(path: string):                       number;
  getRecentFiles():                                Promise<string>;
  onRecentFilesChange?(callback: () => void): () => void;
  saveAsFile(content: string, defaultName: string, format?: string): Promise<void>;
  getExportFormats?(): ExportFormat[];
  openFile(path: string, name: string):             void;
}
```

`null` → attachment button and "Save as" options are hidden.

`pickFiles` receives the format groups the widget can actually attach, exported
as `ATTACHMENT_PICK_FILTERS`. A host that can configure its native dialog should
render one filter row per entry, in order, and **must not** add an "all files"
row: the widget re-checks every returned path against the same list and silently
drops anything outside it, so a file picked through such a row would attach
nothing. The argument is additive — a host whose `pickFiles` takes no parameters
keeps working unchanged, and the widget's own check, not the dialog, is what
enforces the format set.

```ts
import { ATTACHMENT_PICK_FILTERS } from "@onlyoffice/ai-chat";

// A host mapping the groups onto its own dialog API:
pickFiles: (filters = ATTACHMENT_PICK_FILTERS) =>
  nativeDialog.open({
    filters: filters.map((f) => ({
      name: localize(f.id) ?? f.label,
      extensions: f.extensions,
    })),
  });
```

Images are **not** in this list: "Add local image" rides an internal
`<input accept="image/*">` and never reaches `pickFiles`.

A **web host that opens its own file dialog** — a `composerActions` entry, a
portal upload flow — never reaches `pickFiles` either, so the filter groups
above do nothing for it. Use `ATTACHMENT_ACCEPT` instead: the same format set
rendered as an `accept` attribute, so the browser's dialog greys out everything
the widget cannot convert rather than letting the user pick an archive and hit
an error after the upload.

```tsx
import { ATTACHMENT_ACCEPT } from "@onlyoffice/ai-chat";

<input type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={…} />;
```

It is extensions only (`.docx,.xlsx,…`), no MIME types — the widget keys the
set by extension everywhere, and formats like `oform` / `docxf` have no MIME
type a browser knows. Both constants derive from the same list, so a format
added in one place reaches the other.

The library always passes Markdown source as `saveAsFile`'s `content`; the host
converts it to the target format. Declare more than one `getExportFormats()`
entry to replace the chat-list "Save" item with an "Export" submenu — the chosen
`ExportFormat.id` is forwarded as `saveAsFile`'s third `format` argument. Omit
`getExportFormats` (or return one/zero entries) to keep the single default "Save"
action, where `saveAsFile` is called with two arguments as before.

`onRecentFilesChange` lets the host invalidate the "Recent files" submenu.
The callback takes no payload — `getRecentFiles()` stays the only source of
the list, and the widget re-reads it on every signal, keeping the newest
answer when signals arrive in a burst. Return an unsubscribe function; it is
called on unmount. Omit the method and the widget reads the list once on
mount, which is enough where the page reloads with the document but leaves
the submenu frozen in a long-lived embedding such as a desktop plugin panel.

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
    callback: (info: {
      theme?: string;
      lang?: string;
      devicePixelRatio?: number;
    }) => void,
  ) => () => void;
}
```

`devicePixelRatio` in the callback is optional and additive: report it when
the display density changes (window moved to a monitor with a different DPR,
browser zoom, …) so scale-appropriate raster icons re-select at runtime in
`iconFormat: "png"` mode. Hosts that never send it keep
the density read at startup — nothing breaks. A DPR-aware `onEnvironmentChange`
looks like:

```ts
onEnvironmentChange(cb) {
  const offTheme = subscribeToHostTheme((t) => cb({ theme: t }));

  // A resolution media query is bound to one dppx value, so re-arm the
  // listener after each change to track the new ratio.
  let mql: MediaQueryList;
  const onDpr = () => {
    cb({ devicePixelRatio: window.devicePixelRatio });
    arm();
  };
  const arm = () => {
    mql?.removeEventListener("change", onDpr);
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener("change", onDpr);
  };
  arm();

  return () => {
    offTheme();
    mql?.removeEventListener("change", onDpr);
  };
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

Per-profile opt-in: set `Profile.useProxy: true` on a profile to
route all its provider traffic through `fetchProxy`. Profiles without
the flag continue to use the global `fetch`.

### `externalFetch`

Transport hook used exclusively by the [`external`](./core/providers/built-in.md#external)
built-in provider. The external provider has no SDK and no
fallback `fetch` — every request it makes (chat completions, sync
text, model listing, connection probes) is delegated to this
function. The host is responsible for the network call,
authentication, and URL routing; the library only parses the
response in the format chosen by `Profile.basedOn` (currently
`"openai"`).

```ts
const platform: PlatformAdapter = {
  // ...
  externalFetch: async (url, init) =>
    fetch("/api/ai/external", {
      ...init,
      headers: { ...init?.headers, "x-upstream-url": url },
    }),
};
```

Required for every profile with `providerType: "external"` —
absence raises a clear error at request time. Independent of
`Profile.useProxy` and `fetchProxy`.

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

## `ToolsAdapter`

Optional pluggable runtime tool source. The engine calls
`getTools()` server-side alongside the built-in web-search /
image-generation sources, then dispatches `callTool(...)`
automatically when the model picks one of the adapter's tools —
no UI approval round-trip.

```ts
interface ToolsAdapter {
  /**
   * Tools grouped by `serverType` (the same key used in
   * `storage.toolPrefs.disabled`). Grouping lets the engine apply
   * the persisted disabled-tool filter without parsing prefixes
   * out of tool names.
   *
   * `entityId` mirrors `WidgetConfig.entityId` (opaque per-room
   * scope). `config.attachmentId` carries the attachment ref ids
   * collected from every message of the current request — useful
   * for surfacing attachment-specific tools (e.g. PDF parsers
   * when a PDF is attached).
   */
  getTools(
    entityId?: string,
    config?: { attachmentId: string[] }
  ): Promise<Record<string, TMCPItem[]>>;

  /**
   * Execute a tool by name. Implementations should stringify
   * thrown errors into the result so the model can react to them
   * rather than aborting the stream. `entityId` is forwarded so
   * implementations can route execution per-room.
   */
  callTool(
    toolName: string,
    args: Record<string, unknown>,
    entityId?: string
  ): Promise<unknown>;
}
```

Pass it to the widget via the `toolsAdapter` prop or directly to
`AIEngine` deps in headless mode. Adapter-served tools never
surface in the approval dialog — they execute the moment the
model picks them, results stream back in the next assistant
message. On user deny, the engine resumes with the literal
string `"User deny tool call"` itself — there is no adapter
hook for that path.

> **System tools** are the exception. The built-in
> [`SystemToolsSource`](../src/core/services/tools/system-tools-source.ts)
> connects to host-configured MCP servers (HTTP) server-side; its
> tools **do** surface for UI approval, yet still execute in-engine.
> Combine adapters with `composeToolsAdapters(...)` and mark the
> system server types via `AIEngineDeps.systemServerTypes`. See
> [headless usage](./headless-usage.md#system-server-side-mcp-tools).

### Stub example

```ts
const toolsAdapter: ToolsAdapter = {
  async getTools(entityId, config) {
    return {
      "demo-server-a": [
        {
          name: "echo_a",
          description: "Echo input back.",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
          },
        },
      ],
    };
  },
  async callTool(name, args, entityId) {
    if (name === "echo_a") {
      return JSON.stringify({ data: { echo: args.text ?? null } });
    }
    return JSON.stringify({ data: { ok: true, called: name, args } });
  },
};
```

The host owns this adapter; the snippet above is the whole contract.
