# `core/storage` — full reference

This folder contains **type-only** contracts. The library defines
*what* persistence looks like; concrete backends (IndexedDB, REST,
in-memory, …) live outside `core/`. The built-in IndexedDB
implementation is at [`src/storage/`](../../../src/storage/).

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
└── lifecycle      init() / close()
```

The adapter is created by the host, registered through React
context (`StorageProvider`), and consumed everywhere via
`useStorage()` or via dependency injection into `core/services/`
and the higher-level `src/services/` layer.

See also: [`docs/adapters.md`](../../adapters.md) for the
adapter pattern at the widget level, and [`docs/architecture.md`](../../architecture.md)
for how storage relates to the rest of the layers.
