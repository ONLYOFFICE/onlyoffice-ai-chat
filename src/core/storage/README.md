# `core/storage`

Type-only contract for persistence. The library never imports a
concrete storage engine — instead, each domain has its own
`*Storage` interface, the host injects an implementation, and
everything else (services, hooks, UI) depends on the
interface alone. The built-in implementation lives outside this
folder under [`src/storage/`](../../storage/) and uses IndexedDB.

[`StorageAdapter`](./adapter.ts) aggregates all 10 sub-storages
into a single object that gets passed through React context:

| Sub-storage                                             | Domain                                            |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`ThreadsStorage`](./threads.ts)                        | Chat sessions and their `lastEditDate` timestamps |
| [`MessagesStorage`](./messages.ts)                      | Messages scoped to a thread                       |
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

## Full documentation

See [`docs/core/storage/`](../../../docs/core/storage/README.md):

- [`storage.md`](../../../docs/core/storage/storage.md) — every
  sub-storage's methods, semantics, error cases, and how
  services layer business rules on top of plain CRUD.
