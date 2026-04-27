# `core/services` — full reference

The `core/services/` folder hosts the orchestration layer between
the **higher-level services / UI** on one side and the
**`actions/`** + **`providers/`** + **`storage/`** layers on the
other. The classes here (named `*Engine` for historical reasons)
encode the business rules that plain storage CRUD or a single
action call cannot express on its own: profile resolution, thread
lifecycle, credential validation, capability checks, assignment
cascade.

There are eight services today:

| Document                                                | Class             | Topic |
| ------------------------------------------------------- | ----------------- | ----- |
| [`ai-engine.md`](./ai-engine.md)                        | `AIEngine`        | Streaming chat, one-shot actions, free-form custom-prompt calls |
| [`profiles-engine.md`](./profiles-engine.md)            | `ProfilesEngine`  | Profile CRUD with uniqueness, credential check, and cascade |
| [`assignments-engine.md`](./assignments-engine.md)      | `AssignmentsEngine` | `ActionType → profileId` resolution, capability-validated bind, cascade-on-delete |
| [`threads-engine.md`](./threads-engine.md)              | `ThreadsEngine`   | Thread lifecycle: create, open-or-create with auto title, rename, regenerate title, clear |
| [`tools-engine.md`](./tools-engine.md)                  | `ToolsEngine`     | Custom MCP servers CRUD with validation + tool prefs (disabled / auto-approve) |
| [`prompts-engine.md`](./prompts-engine.md)              | `PromptsEngine`   | Prompt + folder CRUD with scoped name uniqueness, atomic move, versioned import / export |
| [`web-search-engine.md`](./web-search-engine.md)        | `WebSearchEngine` | Singleton web-search config with live credential validation and atomic switch |
| [`preferences-engine.md`](./preferences-engine.md)      | `PreferencesEngine` | Scalar preferences with default-fallback `get` and idempotent `set` |

## How they compose

```
                ┌──────────────┐
                │   AIEngine   │  high-level: streaming chat, one-shot, custom
                └──┬────────┬──┘
                   │        │
          ┌────────▼┐      ┌▼─────────────┐
          │Threads  │      │Assignments   │
          │Engine   │      │Engine        │
          └────┬────┘      └────┬─────────┘
               │                │
               │           ┌────▼──────────┐
               │           │ProfilesEngine │ (uses AssignmentsEngine for cascade)
               │           └────┬──────────┘
               │                │
   ┌───────────┘                │              ┌──────────┐  ┌──────────┐
   │                            │              │  Tools   │  │ Prompts  │
   │                            │              │  Engine  │  │  Engine  │
   │                            │              └────┬─────┘  └────┬─────┘
   │                            │                   │             │
   ▼                            ▼                   ▼             ▼
        ┌────────────────────────────────────────────────────────────────┐
        │                       StorageAdapter                           │
        │ threads · messages · profiles · assignments · prompts ·        │
        │ promptFolders · mcpServers · toolPrefs · preferences · …       │
        └────────────────────────────────────────────────────────────────┘
```

`AIEngine` builds default `AssignmentsEngine` and `ThreadsEngine`
from the `storage` you pass in. You can also pass your own
instances when you want to share a single sub-service across
multiple parents, or substitute a test double.

## Where these services fit in the layer cake

```
┌──────────────────────────────────────────────────────────────────┐
│  UI / hooks / higher-level services                              │
│  (ChatEngine, ProfilesService, ThreadsService, AIChatWidget…)    │
└─────────────────────┬────────────────────────────────────────────┘
                      │ instantiate per-AppContext, call methods
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│  core/services                                                   │
│   AIEngine   ProfilesEngine   AssignmentsEngine   ThreadsEngine  │
│   ToolsEngine   PromptsEngine   WebSearchEngine   PreferencesEng │
└─────────────────────┬────────────────────────────────────────────┘
                      │ delegate to
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│  core/actions       core/providers       core/storage            │
│  (chat, summarize,  (16 providers,       (StorageAdapter:        │
│   translate, …)      registry)             threads, messages,    │
│                                            profiles, assignments)│
└──────────────────────────────────────────────────────────────────┘
```

`core/services/` lives below the higher-level `src/services/`
layer (which holds Zustand-coupled glue like `ChatEngine`,
`ProfilesService`, etc.) and above the storage / actions /
providers primitives.

These services own:

- **Profile resolution** — turning an `ActionType` into a concrete
  `Profile` via the assignment table, with `Default` as the
  fallback (`AssignmentsEngine`).
- **Thread persistence** — open or create the thread, save the
  user message, save the terminal assistant message, regenerate
  titles (`ThreadsEngine`).
- **Action dispatch** — pick the right action function for the
  given `ActionType`, drain a stream when the caller wants a
  single reply (`AIEngine`).
- **Profile validation** — call into `Provider.checkProvider` to
  verify credentials, normalize all failure shapes to
  `TErrorData` (`ProfilesEngine`).
- **Capability validation** — refuse to bind a profile to a slot
  whose `CapabilitiesUI` requirements it doesn't meet
  (`AssignmentsEngine`).
- **Cascade cleanup** — on profile delete, promote a new
  `Default` and drop orphaned per-action assignments
  (`AssignmentsEngine.cascadeProfileDelete`, called from
  `ProfilesEngine.delete`).
- **MCP-server validation + tool-pref bookkeeping** — verify
  transport config shape, reject duplicate names, manage
  disabled / auto-approve lists with idempotent writes
  (`ToolsEngine`).
- **Prompt-library integrity** — folder reference checks, name
  uniqueness in folder scope, atomic move, versioned bundle
  import / export (`PromptsEngine`).
- **Web-search credential validation** — live `testConnection`
  with normalized error shapes; atomic provider switch
  (`WebSearchEngine`).
- **Scalar-pref defaults** — return a sensible value when
  nothing has been persisted, idempotent writes
  (`PreferencesEngine`).

These services do **not** own:

- UI state (Zustand stores) — that's the higher-level
  `src/services/` layer.
- Streaming UX (deltas, tool approvals, abort wiring) — that's
  `ChatEngine` in `src/services/`.
- Adapter implementations — every service here depends on
  [`StorageAdapter`](../../../src/core/storage/adapter.ts)
  interfaces only.
- Browser-only APIs — `core/` runs on both server and client.

## Construction

All eight services take a single dependency object:

```ts
import {
  AIEngine,
  ProfilesEngine,
  AssignmentsEngine,
  ThreadsEngine,
  ToolsEngine,
  PromptsEngine,
  WebSearchEngine,
  PreferencesEngine,
} from "@/core/services";

const assignments = new AssignmentsEngine({ storage });
const threads = new ThreadsEngine({ storage });
const profiles = new ProfilesEngine({ storage, assignments });
const ai = new AIEngine({ storage, assignments, threads });
const tools = new ToolsEngine({ storage });
const prompts = new PromptsEngine({ storage });
const webSearch = new WebSearchEngine({ storage });
const preferences = new PreferencesEngine({ storage });
```

Sub-services are optional. If you don't pass them, the parent
constructs its own:

```ts
const ai = new AIEngine({ storage });            // builds its own assignments + threads
const profiles = new ProfilesEngine({ storage }); // builds its own assignments
```

Services hold no per-call state, so re-use is safe across
requests and across components.

## Public API surface

All entry points are exported from
[`src/core/services/index.ts`](../../../src/core/services/index.ts):

```ts
export { AIEngine } from "./ai";
export type {
  AIEngineDeps, SendCustomInput, SendInput, SendResult, SendStreamInput,
} from "./ai";

export { ProfilesEngine } from "./profiles";
export type {
  CreateProfileInput, ProfileMutationResult, ProfilesEngineDeps,
} from "./profiles";

export { AssignmentsEngine } from "./assignments";
export type {
  AssignmentMutationResult, AssignmentsEngineDeps,
  BulkAssignmentResult, ResolvedAssignment,
} from "./assignments";

export { ThreadsEngine } from "./threads";
export type {
  OpenOrCreateInput, OpenOrCreateResult, ThreadsEngineDeps,
} from "./threads";

export { ToolsEngine } from "./tools";
export type {
  McpTransportConfig, ToolsBulkResult, ToolsEngineDeps, ToolsMutationResult,
} from "./tools";

export { PromptsEngine } from "./prompts";
export type {
  CreatePromptInput, FolderMutationResult,
  ImportError, ImportMode, ImportResult,
  PromptBundle, PromptMutationResult, PromptsEngineDeps,
} from "./prompts";

export { WebSearchEngine } from "./web-search";
export type { WebSearchEngineDeps, WebSearchMutationResult } from "./web-search";

export { PreferencesEngine, DEFAULT_PREFERENCES } from "./preferences";
export type { PreferenceDefaults, PreferencesEngineDeps } from "./preferences";
```
