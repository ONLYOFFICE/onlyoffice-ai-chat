# `core/storage` — full reference

This folder contains **type-only** contracts. The library defines
*what* persistence looks like; concrete backends (IndexedDB, REST,
in-memory, …) live outside `core/` and are supplied by the host.

| Document                          | Topic |
| --------------------------------- | ----- |
| [`storage.md`](./storage.md)      | Every sub-storage interface — methods, semantics, error cases, examples |

## Quick map

```
StorageAdapter
├── threads        chat sessions
├── messages       messages within threads
├── profiles       AI provider profiles
├── prompts        saved prompt templates
├── promptFolders  one-level grouping for prompts
├── assignments    ActionType → profileId map
├── preferences    scalar toggles (deep mode, …)
├── mcpServers     custom MCP server configs
├── toolPrefs      disabled / auto-approved tools
├── webSearch      web-search provider config (singleton)
├── attachments    user-message attachments (files + images, ref-only persistence)
├── getContextFolders()  optional — rooms grouped by cloud for the composer's context picker
├── getRoomSkills()      optional — skills of a connected room (frontmatter), one switch each
├── getRoomSkill()       optional — one skill's body, read when the model calls read_skill
└── lifecycle      init() / close()
```

The adapter is created by the host, supplied to the widget via the
`storage` prop, and consumed by dependency injection into
`core/services/` engines.

### Entity scoping (`entityId`)

`threads`, `assignments`, `preferences`, `mcpServers`,
`toolPrefs`, and `webSearch` accept an optional `entityId` last
argument that scopes each call to a "room" — the persistence
side of [`WidgetConfig.entityId`](../../../src/widget-config.tsx).
`undefined` means the unscoped (global) namespace; a string id
selects an isolated per-entity namespace. `profiles`, `messages`,
`prompts`, and `promptFolders` are intentionally unscoped (they
are either shared across entities or already addressed by an id
that carries the scope). See [`storage.md`](./storage.md#entity-scoping-entityid)
for the full contract.

See also: [`docs/adapters.md`](../../adapters.md) for the
adapter pattern at the widget level, and [`docs/architecture.md`](../../architecture.md)
for how storage relates to the rest of the layers.
