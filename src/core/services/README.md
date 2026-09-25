# `core/services`

Thin orchestrators that bind the [`actions/`](../actions/) layer
to a [`StorageAdapter`](../storage/adapter.ts). The classes here
(`AIEngine`, `ProfilesEngine`, …) are the single entry point a
hook or UI handler should reach for when it wants to *do*
something — send a message, run a one-shot summarization, create
or delete a profile, rename a thread, bind a profile to an action,
register a custom MCP server, save a prompt — without
re-implementing the bookkeeping each caller would otherwise need
(profile resolution, thread persistence, capability validation,
name uniqueness, transport-config validation, assignment /
folder cascades).

Code in `core/` runs both on the server and the client — every
service does its I/O exclusively through injected adapters and
never touches browser-only APIs.

| Service                                           | Source                       | Purpose                                                                       |
| ------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------- |
| [`AIEngine`](./ai/engine.ts)                     | `core/services/ai`            | Run an AI action: stream chat with thread persistence, or one-shot any action |
| [`ProfilesEngine`](./profiles/engine.ts)         | `core/services/profiles`      | Profile CRUD with uniqueness checks, credential validation, and cascade cleanup |
| [`AssignmentsEngine`](./assignments/engine.ts)   | `core/services/assignments`   | `ActionType → profileId` resolution + capability-validated writes + cascade-on-delete |
| [`ThreadsEngine`](./threads/engine.ts)           | `core/services/threads`       | Thread lifecycle: create, open-or-create with auto title, rename, regenerate title, clear messages |
| [`ToolsEngine`](./tools/engine.ts)               | `core/services/tools`         | Custom MCP servers CRUD with name + transport-config validation, plus disabled / auto-approve tool prefs |
| [`PromptsEngine`](./prompts/engine.ts)           | `core/services/prompts`       | Saved prompts and folders CRUD with name uniqueness in folder scope, atomic move, and versioned import / export |
| [`WebSearchEngine`](./web-search/engine.ts)      | `core/services/web-search`    | Web-search singleton config with live credential validation and atomic switch |
| [`PreferencesEngine`](./preferences/engine.ts)   | `core/services/preferences`   | Scalar preferences (deep mode, …) with default fallback and idempotent writes |
| [`ContextEngine`](./context/engine.ts)           | `core/services/context`       | Rooms offered as chat context (grouped by cloud) and the skills of a connected room — the optional `StorageAdapter` reads behind the `ServerAPI` bridge |

`AIEngine` composes `AssignmentsEngine` + `ThreadsEngine` to keep
its three public methods short. `ProfilesEngine.delete` composes
`AssignmentsEngine` for the cascade. `ToolsEngine` and
`PromptsEngine` are persistence-only — they don't manage live
MCP connections (that stays in [`src/tools/`](../../tools)) or
rendering. Every service accepts its dependencies through a
single `{ storage, ... }` object — sub-services are optional, the
parent constructs them by default.

## Full documentation

See [`docs/core/services/`](../../../docs/core/services/README.md)
for the detailed reference:

- [`AIEngine`](../../../docs/core/services/ai-engine.md) —
  streaming chat, one-shot actions, free-form custom prompts,
  internals.
- [`ProfilesEngine`](../../../docs/core/services/profiles-engine.md)
  — CRUD, default-slot auto-assign, cascade behavior, error
  shapes.
- [`AssignmentsEngine`](../../../docs/core/services/assignments-engine.md)
  — resolution with `Default` fallback, capability-aware bind,
  bulk-assign, cascade hook.
- [`ThreadsEngine`](../../../docs/core/services/threads-engine.md)
  — create / open / rename / regenerate-title / clear / list.
- [`ToolsEngine`](../../../docs/core/services/tools-engine.md) —
  MCP-server registration with validation + tool prefs (disabled
  / auto-approve) with idempotent writes.
- [`PromptsEngine`](../../../docs/core/services/prompts-engine.md)
  — prompt + folder CRUD with scoped uniqueness, atomic move,
  versioned import / export bundles.
- [`WebSearchEngine`](../../../docs/core/services/web-search-engine.md)
  — singleton config with live `testConnection` and atomic
  switch.
- [`PreferencesEngine`](../../../docs/core/services/preferences-engine.md)
- [`ContextEngine`](../../../docs/core/services/context-engine.md)
  — scalar prefs with default-fallback `get` and idempotent
  `set`.
