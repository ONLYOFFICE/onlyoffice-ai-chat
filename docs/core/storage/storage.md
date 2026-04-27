# Storage interfaces — full reference

> Sources: [`src/core/storage/`](../../../src/core/storage)

`StorageAdapter` is a single object that bundles ten domain-specific
storage interfaces. The library reads / writes data exclusively
through these interfaces; the built-in IndexedDB implementation,
plus any third-party backend (REST, SQLite, in-memory, server-pushed,
…) implements the same contracts.

The contract is intentionally a **plain CRUD** layer — uniqueness
checks, cascading deletes that span multiple sub-stores, profile
auto-assignment and other business rules live in
[`core/services/`](../services/README.md), not here.

---

## `StorageAdapter`

> Source: [`adapter.ts`](../../../src/core/storage/adapter.ts)

```ts
interface StorageAdapter {
  threads: ThreadsStorage;
  messages: MessagesStorage;
  profiles: ProfilesStorage;
  prompts: PromptsStorage;
  promptFolders: PromptFoldersStorage;
  assignments: AssignmentsStorage;
  preferences: PreferencesStorage;
  mcpServers: McpServersStorage;
  toolPrefs: ToolPrefsStorage;
  webSearch: WebSearchStorage;

  init(): Promise<void>;   // open DB, run migrations
  close(): Promise<void>;  // flush + release resources
}
```

`init()` runs once before any other call; the widget awaits it on
first mount. `close()` runs when `AIChatProvider` unmounts.
Implementations are free to be lazy as long as the public methods
behave correctly after `init` resolves.

---

## `ThreadsStorage`

> Source: [`threads.ts`](../../../src/core/storage/threads.ts)

A thread is a single chat session: title, optional `profileId`
binding, and a `lastEditDate` used to sort the sidebar.

```ts
create(title: string, profileId?: string): Promise<Thread>;   // storage assigns threadId + lastEditDate
readById(threadId: string): Promise<Thread | null>;
readAll(): Promise<Thread[]>;                      // sorted by lastEditDate desc
update(threadId: string, title?: string): Promise<void>;
touch(
  threadId: string,
  lastEditDate: number,
  updates?: { profileId?: string | null }
): Promise<void>;
delete(threadId: string): Promise<void>;           // cascading: also drops messages
```

### Semantics

- **`update` does not bump `lastEditDate`.** If you want the thread
  to resurface in the sidebar after a rename, follow up with
  `touch`. The split keeps "show me history changes" decoupled
  from "the user is just fixing a typo".
- **The caller owns the clock.** `touch` takes the timestamp as
  an argument; storage never reads `Date.now()`. This makes
  deterministic tests trivial.
- **`delete` is cascading.** Implementations must drop every
  message in the thread (typically by delegating to
  `MessagesStorage.deleteByThread`). Engines / services rely on
  that — they never call both manually.

---

## `MessagesStorage`

> Source: [`messages.ts`](../../../src/core/storage/messages.ts)

Messages are stored per-thread but addressed by globally-unique
ID, which lets `update` and `delete` skip thread scoping.

```ts
create(
  threadId: string,
  message: Omit<ThreadMessageLike, "id" | "createdAt">
): Promise<ThreadMessageLike>;       // returns persisted message with id + createdAt
readById(messageId: string): Promise<ThreadMessageLike | null>;
readByThread(
  threadId: string,
  limit?: number,
  startIndex?: number
): Promise<ThreadMessageLike[]>;     // sorted by timestamp asc
update(messageId: string, message: ThreadMessageLike): Promise<void>;
delete(messageId: string): Promise<void>;
deleteByThread(threadId: string): Promise<void>;
```

### Semantics

- **Pagination is offset/limit on a chronologically ascending
  list.** `startIndex: 0` returns the oldest messages first; omit
  both args to read the full thread.
- **`update` overwrites the entire `ThreadMessageLike`.** No
  partial diff — the assistant-ui shape is too entangled to
  patch reliably. Engines pass the full new value.
- **`create` assigns `id` and `createdAt`.** Callers pass only the
  message body; storage owns identifier generation and ordering and
  returns the persisted entity.

---

## `ProfilesStorage`

> Source: [`profiles.ts`](../../../src/core/storage/profiles.ts)

A profile = provider type + base URL + key + selected model +
capability flags. Profiles are referenced by threads (to remember
which profile spawned the thread) and by `AssignmentsStorage` (to
route an `ActionType` to a profile).

```ts
create(input: Omit<Profile, "id" | "createdAt">): Promise<Profile>;
createMany(
  inputs: Omit<Profile, "id" | "createdAt">[]
): Promise<Profile[]>;                                    // bulk import / migration
readById(id: string): Promise<Profile | undefined>;
readAll(): Promise<Profile[]>;
update(profile: Profile): Promise<void>;                  // replace all fields
delete(id: string): Promise<void>;
```

### Semantics

- **Plain CRUD.** Name uniqueness, credential validation, cascade
  cleanup of `AssignmentsStorage` rows — all of that lives in
  [`ProfilesEngine`](../services/profiles-engine.md). Reach for the
  engine when you want those rules.
- **`update` replaces every field.** The `id` in the payload
  identifies the row; everything else is overwritten verbatim.

---

## `PromptsStorage`

> Source: [`prompts.ts`](../../../src/core/storage/prompts.ts)

Saved prompt templates the user can reuse from the composer. Can
optionally belong to a `PromptFolder`.

```ts
create(
  input: Omit<Prompt, "id" | "createdAt" | "updatedAt">
): Promise<Prompt>;                                            // storage assigns id + timestamps
createMany(prompts: Prompt[]): Promise<void>;                  // bulk import — preserves bundle ids
readById(id: string): Promise<Prompt | null>;
readAll(): Promise<Prompt[]>;                                 // sorted by createdAt desc
readByFolderId(folderId: string | null): Promise<Prompt[]>;   // null = root level
update(
  id: string,
  updates: { name?: string; text?: string; folderId?: string | null }
): Promise<void>;
delete(id: string): Promise<void>;
deleteByFolder(folderId: string): Promise<void>;
```

### Semantics

- **`update` is a partial patch** — only the fields you pass are
  changed, plus `updatedAt` is bumped automatically.
- **`folderId: null` means "no folder".** `readByFolderId(null)`
  returns root-level prompts.
- **`deleteByFolder` is the cascade hook** for
  `PromptFoldersStorage.delete`. Folder deletion drops every
  prompt inside.

---

## `PromptFoldersStorage`

> Source: [`prompt-folders.ts`](../../../src/core/storage/prompt-folders.ts)

One-level grouping for saved prompts. No nested folders — flat by
design.

```ts
create(
  input: Omit<PromptFolder, "id" | "createdAt" | "updatedAt">
): Promise<PromptFolder>;                              // storage assigns id + timestamps
createMany(folders: PromptFolder[]): Promise<void>;    // bulk import — preserves bundle ids
readById(id: string): Promise<PromptFolder | null>;
readAll(): Promise<PromptFolder[]>;          // sorted by createdAt desc
update(id: string, name: string): Promise<void>;   // rename only, bumps updatedAt
delete(id: string): Promise<void>;                  // cascading: also drops contained prompts
```

`update` only takes a new name — folders have no other mutable
attributes today.

---

## `AssignmentsStorage`

> Source: [`assignments.ts`](../../../src/core/storage/assignments.ts)

Maps each `ActionType` (`Default`, `Chat`, `Summarization`,
`Translation`, `TextAnalyze`, `ImageGeneration`, `OCR`, `Vision`)
to a single profile ID. Used by [`AIEngine`](../services/ai-engine.md)
to resolve "which profile runs the chat action".

```ts
create(actionType: ActionType, profileId: string): Promise<void>; // throws if exists
readByType(actionType: ActionType): Promise<string | null>;
readAll(): Promise<Partial<Record<ActionType, string>>>;
update(actionType: ActionType, profileId: string): Promise<void>; // throws if missing
upsertMany(
  assignments: Partial<Record<ActionType, string>>
): Promise<void>;                                                  // batched, idempotent, single transaction
delete(actionType: ActionType): Promise<void>;                    // no-op if missing
deleteMany(actionTypes: ActionType[]): Promise<void>;             // batched, no-op per missing key
```

### Semantics

- **`create` and `update` are explicit.** `create` throws when an
  assignment already exists; `update` throws when it doesn't.
  Single-row writes use the right call for the situation.
- **`upsertMany` is the bulk write path.** Idempotent per entry —
  creates when the slot is empty, replaces when bound to a
  different profile, no-op when bound to the same profile.
  Implementations are expected to run all writes in a single
  transaction so the table never observes a half-written state.
  `AssignmentsEngine` uses `upsertMany` for both single
  `assign` and `bulkAssign` to keep one mechanism end-to-end.
- **`delete*` are idempotent.** Cascading code in
  `ProfilesEngine.delete` calls `deleteMany` for orphaned slots
  without checking presence first.
- **The `Default` slot** is the global fallback. Engines look up
  `readByType(<actionType>)` first and fall back to
  `readByType(ActionType.Default)` if it returns `null`.

---

## `PreferencesStorage`

> Source: [`preferences.ts`](../../../src/core/storage/preferences.ts)

Scalar toggles. Each preference gets its own typed CRUD quartet —
no stringly-typed keys, no JSON parsing at call sites.

Today the only entry is the **deep-mode** toggle (extended thinking):

```ts
createDeepMode(value: boolean): Promise<void>;   // throws if already set
readDeepMode(): Promise<boolean | null>;          // null = never set, fall back to default
updateDeepMode(value: boolean): Promise<void>;   // throws if never set
upsertDeepMode(value: boolean): Promise<void>;   // idempotent — used by PreferencesEngine
deleteDeepMode(): Promise<void>;                  // clears, future reads return null
```

The shape is intentionally extensible: a new scalar pref adds
five new methods (`create`/`read`/`update`/`upsert`/`delete`).
That keeps each call site self-documenting and the type system
tight.

---

## `McpServersStorage`

> Source: [`mcp-servers.ts`](../../../src/core/storage/mcp-servers.ts)

Custom MCP server registrations, keyed by user-supplied name.

```ts
type McpServerConfig = Record<string, unknown>;  // transport-agnostic blob

create(name: string, config: McpServerConfig): Promise<void>; // throws on dup
readByName(name: string): Promise<McpServerConfig | null>;
readAll(): Promise<Record<string, McpServerConfig>>;
update(name: string, config: McpServerConfig): Promise<void>;  // throws if missing
replaceAll(servers: Record<string, McpServerConfig>): Promise<void>;  // import/restore
delete(name: string): Promise<void>;
```

### Semantics

- **`config` is a transport-agnostic record.** MCP supports
  per-transport fields — `command` / `args` for stdio, `url` for
  HTTP, plus `env`, `headers`, etc. Storage stays out of that
  schema and lets the tool layer interpret it.
- **`replaceAll` is an explicit bulk endpoint.** Outside the
  CRUD surface, but the only sane primitive for "import a JSON
  file the user uploaded".

---

## `ToolPrefsStorage`

> Source: [`tool-prefs.ts`](../../../src/core/storage/tool-prefs.ts)

Two logically distinct preference sets, each with its own quartet.

### Disabled tools

Map of *server type* → list of disabled tool names. Server type
is `"web-search"`, `"image-generation"`, an MCP server name, or
a host-tool group id. A tool not in the map is enabled.

```ts
createDisabled(disabled: Record<string, string[]>): Promise<void>;  // throws if exists
readDisabled(): Promise<Record<string, string[]>>;                  // {} if unset
updateDisabled(disabled: Record<string, string[]>): Promise<void>;  // throws if missing
upsertDisabled(disabled: Record<string, string[]>): Promise<void>;  // idempotent — used by ToolsEngine
deleteDisabled(): Promise<void>;                                     // future reads return {}
```

### Auto-approved tools

Flat list of `"type_name"` tokens the user has chosen to always
allow without per-call confirmation.

```ts
createAllowAlways(tokens: string[]): Promise<void>;    // throws if exists
readAllowAlways(): Promise<string[]>;                   // [] if unset
updateAllowAlways(tokens: string[]): Promise<void>;    // throws if missing
upsertAllowAlways(tokens: string[]): Promise<void>;    // idempotent — used by ToolsEngine
deleteAllowAlways(): Promise<void>;                     // future reads return []
```

The two sets are independent — a tool can be neither, one, or
the other. The "always" list takes effect after the user clicks
"Approve always" in a tool-call dialog.

---

## `WebSearchStorage`

> Source: [`web-search.ts`](../../../src/core/storage/web-search.ts)

Singleton web-search provider config. The widget supports at most
one active provider, so `create` refuses to overwrite — use
`update`.

```ts
type WebSearchConfig = {
  provider: string;          // e.g. "exa"
  key?: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
};

create(config: WebSearchConfig): Promise<void>;   // throws if exists
read(): Promise<WebSearchConfig | null>;
update(config: WebSearchConfig): Promise<void>;   // throws if missing
upsert(config: WebSearchConfig): Promise<void>;   // idempotent — used by WebSearchEngine
delete(): Promise<void>;                           // future reads return null
```

The "create then update / never overwrite via create" pattern
mirrors `PreferencesStorage` and `ToolPrefsStorage` — the same
idea: distinguish initialization from replacement at the type
level, so callers never accidentally clobber existing config.

---

## Designing on top of `StorageAdapter`

- **For CRUD with no business rules** (e.g. saving a draft prompt
  the user just typed), call the sub-storage directly via
  `useStorage()`.
- **For anything that touches multiple sub-stores or has a rule
  that's wrong if you skip it** (uniqueness, cascade, default
  promotion, credential validation), reach for the matching
  engine in [`core/services/`](../services/README.md) first.
- **For new persisted state**, prefer adding a typed quartet on
  an existing sub-storage (or a brand-new one) over reusing a
  loose `Record<string, unknown>` — the type-per-key style is
  what keeps this folder maintainable as it grows.
- **For implementing a new backend**, satisfy each sub-storage
  interface independently; the lifecycle hooks (`init`, `close`)
  on `StorageAdapter` are the only place you need cross-cutting
  setup logic.
