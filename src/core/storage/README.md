# `core/storage`

Type-only contract for persistence. The library never imports a
concrete storage engine — instead, each domain has its own
`*Storage` interface, the host injects an implementation, and
everything else (services, hooks, UI) depends on the
interface alone. No storage engine ships with the library — the host
supplies an implementation of [`StorageAdapter`](./adapter.ts) (the
built-in one used to live under `src/storage/` and was removed).

[`StorageAdapter`](./adapter.ts) aggregates all 11 sub-storages
into a single object that gets passed through React context:

| Sub-storage                                             | Domain                                            |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`ThreadsStorage`](./threads.ts)                        | Chat sessions and their `lastEditDate` timestamps |
| [`MessagesStorage`](./messages.ts)                      | Messages scoped to a thread                       |
| [`pagination`](./pagination.ts)                         | Keyset-cursor types + `drainPages` page walker    |
| [`ProfilesStorage`](./profiles.ts)                      | AI provider profiles                              |
| [`PromptsStorage`](./prompts.ts)                        | Saved prompt templates                            |
| [`PromptFoldersStorage`](./prompt-folders.ts)           | One-level grouping for prompts                    |
| [`AssignmentsStorage`](./assignments.ts)                | `ActionType → profileId` map                      |
| [`PreferencesStorage`](./preferences.ts)                | Scalar toggles (e.g. deep mode)                   |
| [`McpServersStorage`](./mcp-servers.ts)                 | Custom MCP server configurations                  |
| [`ToolPrefsStorage`](./tool-prefs.ts)                   | Disabled / auto-approved tools                    |
| [`WebSearchStorage`](./web-search.ts)                   | Singleton web-search provider config              |

Plus the lifecycle hooks `init()` and `close()` on the aggregate
adapter itself.

## Entity scoping (`entityId`)

Six sub-storages (`threads`, `assignments`, `preferences`,
`mcpServers`, `toolPrefs`, `webSearch`) accept an optional
`entityId` last argument on every method. It is the persistence
side of [`WidgetConfig.entityId`](../widget-config.tsx) "rooms":
`undefined` operates on the unscoped (global) namespace, a
string id selects a per-entity namespace, and the two are kept
strictly disjoint by the implementation. `profiles`, `messages`,
`prompts`, and `promptFolders` are unscoped by design.

See [`docs/core/storage/storage.md`](../../../docs/core/storage/storage.md#entity-scoping-entityid)
for the contract and rationale.

## `createMany` is storage-authoritative

`ProfilesStorage`, `PromptsStorage`, and `PromptFoldersStorage` all
expose a `createMany` for bulk insert. The contract is the same as
`create`: storage assigns `id`, `createdAt`, and `updatedAt`. Callers
pass `Omit<T, "id" | "createdAt" | "updatedAt">[]` and get back the
persisted records (in input order) with storage-assigned fields
populated.

Bundle ids do **not** survive an import round-trip. The
`PromptsEngine.importBundle` flow uses the returned ids to remap
`prompt.folderId` references — custom storage implementations must
follow the same rule (drop incoming ids, mint fresh ones, return them).

## Full documentation

See [`docs/core/storage/`](../../../docs/core/storage/README.md):

- [`storage.md`](../../../docs/core/storage/storage.md) — every
  sub-storage's methods, semantics, error cases, and how
  services layer business rules on top of plain CRUD.
