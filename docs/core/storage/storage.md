# Storage interfaces — full reference

> Sources: [`src/core/storage/`](../../../src/core/storage)

`StorageAdapter` is a single object that bundles eleven domain-specific
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
  attachments: AttachmentsStorage;

  init(): Promise<void>;   // open DB, run migrations
  close(): Promise<void>;  // flush + release resources
}
```

`init()` runs once before any other call; the widget awaits it on
first mount. `close()` runs when `AIChatProvider` unmounts.
Implementations are free to be lazy as long as the public methods
behave correctly after `init` resolves.

---

## Entity scoping (`entityId`)

Six of the eleven sub-storages accept an optional `entityId` argument
on every method. It is the persistence-layer side of the
[`WidgetConfig.entityId`](../../../src/widget-config.tsx) "rooms"
feature: the host binds the widget to an entity (a document, a
channel, an `onlyoffice` room, …) and the data scoped to that
entity is segregated from the global / unscoped namespace and from
every other entity.

| Sub-storage         | Scoped methods                                       | What `entityId` selects |
| ------------------- | ---------------------------------------------------- | ----------------------- |
| `threads`           | `create`, `readAll`                                  | The entity a new thread is bound to / the entity-filtered list. `readById` / `update` / `touch` / `delete` are addressed by `threadId` and need no scope. |
| `assignments`       | `readByType`                                         | An entity-specific Chat profile. `Default` fallback is always unscoped. |
| `preferences`       | every method                                         | Per-entity scalar overrides (e.g. deep-mode toggle). |
| `mcpServers`        | every method                                         | Per-entity MCP server registry — names can collide across entities. |
| `toolPrefs`         | every method (both quartets)                         | Per-entity disabled / auto-approve sets. |
| `webSearch`         | every method                                         | Per-entity singleton config. |

`profiles`, `messages`, `prompts`, and `promptFolders` are
intentionally **not** scoped. Profiles and the prompt library are
shared across entities; messages live inside a thread, which
already carries the scope.

### Contract

- **`entityId` is opaque.** Engines and UI never inspect it; they
  forward whatever the host passed via `WidgetConfig`.
- **`undefined` means "unscoped".** Two entities use storage:
  - `entityId === "<id>"` → the entity's namespace.
  - `entityId === undefined` → the global / passthrough namespace.
  Implementations must keep the two strictly disjoint — a row
  written with no scope is invisible to a scoped read, and vice
  versa.
- **Argument position is always last and always optional.** This
  preserves backward compatibility: callers that don't pass it
  fall through to the unscoped namespace.
- **Cascade rules are scope-local.** `threads.delete(threadId)`
  still drops every message in the thread regardless of
  `entityId` — the thread row carries the binding, so the
  implementation already knows which scope to clean up.

### Implementing an entity-scoped backend

The built-in IndexedDB implementation models scope as a composite
key: `(entityId ?? "__root__", payloadKey)`. Other valid shapes:

- A single table per scope (one IndexedDB store, REST collection,
  SQLite table) keyed by `entityId`.
- A single global table with an indexed `entityId` column and the
  `null`-equivalent representing the unscoped row.

Either is fine — the contract only mandates **isolation**, not
the storage layout.

---

## `ThreadsStorage`

> Source: [`threads.ts`](../../../src/core/storage/threads.ts)

A thread is a single chat session: title, optional `profileId`
binding, and a `lastEditDate` used to sort the sidebar.

```ts
create(
  title: string,
  profileId?: string,
  entityId?: string                              // binds the thread to an entity scope
): Promise<Thread>;                              // storage assigns threadId + lastEditDate
readById(threadId: string): Promise<Thread | null>;
readAll(
  entityId?: string,
  count?: number,                                // optional page size
  cursor?: ThreadsCursor,                        // { lastEditDate, threadId, id } of the last received thread (id == threadId)
  query?: string                                 // case-insensitive title substring, applied BEFORE pagination
): Promise<Thread[]>;                            // scope-filtered, sorted by lastEditDate desc, threadId desc
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
- **Cursor pagination is optional and keyset-based.** Both `count`
  and `cursor` may be omitted — that returns the full list, exactly
  the pre-pagination behavior. When supplied, return up to `count`
  threads strictly AFTER the cursor in `lastEditDate` desc,
  `threadId` desc order; `lastEditDate: null` in the cursor marks an
  anchor thread without a timestamp (undated threads sort last).
  Implementations that don't support pagination may ignore both
  parameters — the widget detects a full dump and stops paging.
- **`query` is a server-side title search** — a **case-insensitive
  substring match** on `title`, applied BEFORE pagination so
  `count`/`cursor` page through the matches. The exact substring
  semantics are contractual: the widget detects an implementation
  that ignored `query` by spotting a non-matching title in the
  response, and for the rest of the session falls back to draining
  all pages and filtering client-side.
- **The caller owns the clock.** `touch` takes the timestamp as
  an argument; storage never reads `Date.now()`. This makes
  deterministic tests trivial.
- **`delete` is cascading.** Implementations must drop every
  message in the thread (typically by delegating to
  `MessagesStorage.deleteByThread`). Engines / services rely on
  that — they never call both manually.
- **Scope is set at creation and frozen.** `create(title, profile,
  entityId)` records the binding; `readAll(entityId)` filters by
  it. There is no API to reassign a thread to a different entity
  — by design, since it would invalidate any per-room ACL the
  host enforces. `readById` ignores scope (the `threadId` is
  globally unique).

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
  count?: number,                    // optional page size
  cursor?: MessagesCursor            // { createdAt: ISO string, id } of the last received message
): Promise<ThreadMessageLike[]>;     // sorted by createdAt asc, id asc
update(messageId: string, message: ThreadMessageLike): Promise<void>;
delete(messageId: string): Promise<void>;
deleteByThread(threadId: string): Promise<void>;
```

### Semantics

- **Pagination is keyset (cursor), not offset.** Omit both args to
  read the full thread — the pre-pagination behavior. When supplied,
  return up to `count` messages strictly AFTER the cursor in
  `createdAt` asc, `id` asc order (`createdAt` travels as an ISO
  string so it survives a JSON round trip through a query param). A
  "before" direction for lazy tail-loading is reserved for a future
  revision — only forward paging is required today. Implementations
  that don't support pagination may ignore both parameters — the
  widget detects a full dump and stops paging.
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
readByType(
  actionType: ActionType,
  entityId?: string                                // optional scope; see below
): Promise<string | null>;
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
  `readByType(<actionType>, entityId)` first and fall back to
  `readByType(ActionType.Default)` (unscoped) if it returns `null`.
- **`entityId` is opaque and only meaningful on `readByType`.**
  Implementations typically honour it for `ActionType.Chat` (so a
  room can pin a different chat profile than the global one) and
  ignore it elsewhere. The `Default` lookup is intentionally
  unscoped — there is no per-entity default.

---

## `PreferencesStorage`

> Source: [`preferences.ts`](../../../src/core/storage/preferences.ts)

Scalar toggles. Each preference gets its own typed CRUD quartet —
no stringly-typed keys, no JSON parsing at call sites.

Today the only entry is the **deep-mode** toggle (extended thinking):

```ts
createDeepMode(value: boolean, entityId?: string): Promise<void>;   // throws if already set in scope
readDeepMode(entityId?: string): Promise<boolean | null>;            // null = never set in scope
updateDeepMode(value: boolean, entityId?: string): Promise<void>;   // throws if never set in scope
upsertDeepMode(value: boolean, entityId?: string): Promise<void>;   // idempotent — used by PreferencesEngine
deleteDeepMode(entityId?: string): Promise<void>;                    // clears the scope's entry
```

Each method takes an optional `entityId` last argument — when
provided, the read/write is scoped to that entity, otherwise it
operates on the unscoped (global) value. See
[Entity scoping (`entityId`)](#entity-scoping-entityid).

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

create(
  name: string,
  config: McpServerConfig,
  entityId?: string
): Promise<void>;                                              // throws on dup *in scope*
readByName(
  name: string,
  entityId?: string
): Promise<McpServerConfig | null>;
readAll(entityId?: string): Promise<Record<string, McpServerConfig>>;
update(
  name: string,
  config: McpServerConfig,
  entityId?: string
): Promise<void>;                                              // throws if missing in scope
replaceAll(
  servers: Record<string, McpServerConfig>,
  entityId?: string
): Promise<void>;                                              // import/restore
delete(name: string, entityId?: string): Promise<void>;
```

### Semantics

- **`config` is a transport-agnostic record.** MCP supports
  per-transport fields — `command` / `args` for stdio, `url` for
  HTTP, plus `env`, `headers`, etc. Storage stays out of that
  schema and lets the tool layer interpret it.
- **`replaceAll` is an explicit bulk endpoint.** Outside the
  CRUD surface, but the only sane primitive for "import a JSON
  file the user uploaded".
- **Server names are unique per scope, not globally.** Two
  entities can both register a server named `"github"` without
  colliding. Cross-scope reads / writes are not provided —
  callers carry the `entityId` from the widget mount.

---

## `ToolPrefsStorage`

> Source: [`tool-prefs.ts`](../../../src/core/storage/tool-prefs.ts)

Two logically distinct preference sets, each with its own quartet.

### Disabled tools

Map of *server type* → list of disabled tool names. Server type
is `"web-search"`, `"image-generation"`, an MCP server name, or
a host-tool group id. A tool not in the map is enabled.

```ts
createDisabled(
  disabled: Record<string, string[]>,
  entityId?: string
): Promise<void>;                                                    // throws if exists in scope
readDisabled(entityId?: string): Promise<Record<string, string[]>>;  // {} if unset
updateDisabled(
  disabled: Record<string, string[]>,
  entityId?: string
): Promise<void>;                                                    // throws if missing in scope
upsertDisabled(
  disabled: Record<string, string[]>,
  entityId?: string
): Promise<void>;                                                    // idempotent — used by ToolsEngine
deleteDisabled(entityId?: string): Promise<void>;                    // future reads return {}
```

### Auto-approved tools

Flat list of `"type_name"` tokens the user has chosen to always
allow without per-call confirmation.

```ts
createAllowAlways(tokens: string[], entityId?: string): Promise<void>; // throws if exists in scope
readAllowAlways(entityId?: string): Promise<string[]>;                  // [] if unset
updateAllowAlways(tokens: string[], entityId?: string): Promise<void>; // throws if missing in scope
upsertAllowAlways(tokens: string[], entityId?: string): Promise<void>; // idempotent — used by ToolsEngine
deleteAllowAlways(entityId?: string): Promise<void>;                    // future reads return []
```

The two sets are independent — a tool can be neither, one, or
the other. The "always" list takes effect after the user clicks
"Approve always" in a tool-call dialog. Both sets are scoped by
`entityId` independently, so a room can grant tool auto-approval
that does not leak to the global namespace or to sibling rooms.

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
  headers?: Record<string, string>; // extra headers for the ONLYOFFICE / cloud backend
};

create(config: WebSearchConfig, entityId?: string): Promise<void>; // throws if exists in scope
read(entityId?: string): Promise<WebSearchConfig | null>;
update(config: WebSearchConfig, entityId?: string): Promise<void>; // throws if missing in scope
upsert(config: WebSearchConfig, entityId?: string): Promise<void>; // idempotent — used by WebSearchEngine
delete(entityId?: string): Promise<void>;                           // future reads return null
```

The "create then update / never overwrite via create" pattern
mirrors `PreferencesStorage` and `ToolPrefsStorage` — the same
idea: distinguish initialization from replacement at the type
level, so callers never accidentally clobber existing config.

The singleton is *per scope* — every entity has its own active
provider, and the unscoped namespace has its own. Switching
scopes does not roll over the previous scope's config.

---

## `AttachmentsStorage`

> Source: [`attachments.ts`](../../../src/core/storage/attachments.ts)

Persistent records for files and images attached to user messages.
Composer drafts write here eagerly so the in-memory state holds
only lightweight `{ id, title, kind, ... }` refs; the resolver in
`core/actions/attachment-resolution.ts` hydrates them inline right
before the provider sees the message.

```ts
type Attachment = {
  id: string;
  kind: "file" | "image";
  title: string;
  content?: string;     // file text
  base64?: string;      // image data URL
  path?: string;        // file source path
  type?: number;        // ONLYOFFICE file type code
  messageId?: string;   // bound after the user message is persisted
  threadId?: string;    // bound after the user message is persisted
  entityId?: string;    // entity scope at draft creation time
  createdAt: number;
};

create(input: Omit<Attachment, "id" | "createdAt">): Promise<Attachment>;
readById(id: string): Promise<Attachment | null>;
readManyByIds(ids: string[]): Promise<(Attachment | null)[]>;
update(id: string, patch: Partial<Attachment>): Promise<void>;
delete(id: string): Promise<void>;
deleteMany(ids: string[]): Promise<void>;           // batch — single round trip
deleteByMessage(messageId: string): Promise<void>;  // cascade from messages.delete
deleteByThread(threadId: string): Promise<void>;    // cascade from messages.deleteByThread
```

Storage owns id and `createdAt` generation (callers never
synthesize them). `MessagesStorage.delete` and `deleteByThread`
must call `attachments.deleteByMessage` / `deleteByThread` so
removing a message — or the thread that owns it — also purges
its attachments. Drafts the user adds and then never sends are
intentionally left as orphans for now (no GC).

`entityId` is captured at draft creation so composer drafts in
one entity ("room") stay isolated from drafts in another. Once
an attachment is linked to a message via `update`, the entity is
also implied by the owning thread — the field is then redundant
but harmless.

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
