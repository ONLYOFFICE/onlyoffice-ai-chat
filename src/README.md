# `src/` — library source

This is the source tree of **`@onlyoffice/ai-chat`** — a headless AI
chat widget library. The folder is split into three top-level layers
plus a few entry-point files; nothing here is host-specific. All
host integration (real storage, network proxy, file pickers,
clipboard, host tools, …) is injected through adapters.

For the full documentation tree see [`docs/`](../docs/) — this
README only sketches the layout and the rules that hold across the
codebase.

## Layout

```
src/
├── index.ts                # Public entry — re-exports the documented surface
├── AIChatWidget.tsx        # Top-level React component (widget shell)
├── widget-config.tsx       # Widget configuration plumbing
├── app-context.ts          # AppContext type — wiring between layers
├── capabilities.ts         # Re-export surface for CapabilitiesUI + ActionType
├── config.ts               # StoreKeys + default config
├── constants.ts            # Shared constants
├── types.ts                # Top-level type re-exports
├── utils.ts                # Public helper utilities
│
├── core/                   # Pure business logic — no React, no browser-only APIs
│   ├── providers/          # AbstractBaseProvider + registry + 17 built-in providers
│   ├── services/           # Engine classes (orchestration layer, named *Engine)
│   ├── storage/            # StorageAdapter contract + eleven domain sub-storages
│   ├── actions/            # One-shot actions (chat, summarization, translation, OCR, …)
│   ├── middleware/         # ChatMiddleware pipeline + MiddlewareRunner
│   ├── capabilities.ts     # Capability bitmask helpers
│   ├── tools-adapter.ts    # Bridge between core engines and UI tool sources
│   ├── types.ts            # Core domain types (Thread, Profile, Model, Prompt, …)
│   └── index.ts
│
├── ui/                     # React layer
│   ├── components/         # UI primitives (buttons, dialogs, markdown, layouts)
│   ├── pages/              # Page-level containers (chat, ai-models, settings, …)
│   ├── hooks/              # useMessages, useProfiles, useServers, useThreads, …
│   ├── store/              # Zustand stores (createStores, StoresProvider)
│   ├── providers/          # React providers — see below
│   ├── tools/              # Tool runtime: Servers class, HostToolSource, CustomServers
│   └── styles/             # Tailwind CSS + theme files
│
├── shared/                 # Type-only primitives — no deps on core/ui or frameworks
│                           # (provider/model/capability/action types, errors,
│                           # abort, logger, settings-adapter, …)
│
├── translations/           # 41 i18n JSON locales
├── assets/                 # Icons, images
├── tests/                  # Cross-cutting test helpers and fixtures
└── vite-env.d.ts
```

## Layer rules

1. **`shared/` has no dependencies on `core/` or `ui/`** — it is the
   bottom of the dependency graph. Pure types + tiny utilities only.
2. **`core/` does not import from `ui/`** — every engine and
   provider runs without React. UI hooks and stores call into
   engines, never the other way around.
3. **`ui/` consumes `core/` through adapters and engines** — never
   pokes provider internals directly. The widget assembles engines
   inside React providers.
4. **All host integration goes through adapters**: `StorageAdapter`,
   `SettingsAdapter`, `PlatformAdapter`, plus `ToolsAdapter` for
   bridging tool sources. No direct `window.*`, `IndexedDB`,
   `localStorage`, or ONLYOFFICE-specific API calls anywhere here.
5. **Global holders are set synchronously during render** — not in
   `useEffect`. Zustand stores must be able to read holders during
   their first render.

## `core/providers/` — AI provider system

17 built-in providers extend `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>`:
`anthropic`, `openai`, `genai`, `mistral`, `ollama`, `lm-studio`,
`together`, `openrouter`, `deepseek`, `xai`, `openaicompatible`,
`groq`, `zhipu`, `gpt4all`, `stabilityai`, `onlyoffice`.

Custom providers register at runtime through
`registerProvider(type, ProviderClass)` and unregister through
`unregisterProvider(type)`. `ProviderType` is
`BuiltinProviderType | (string & {})` — built-in names autocomplete,
custom strings work transparently.

See [`docs/core/providers/README.md`](../docs/core/providers/README.md).

## `core/services/` — engine classes

Nine `*Engine` classes orchestrate domain logic between actions,
providers, and storage. Each takes a single `{ storage, … }` deps
object and holds no per-call state.

| Engine              | Responsibility |
| ------------------- | -------------- |
| `AIEngine`          | Streaming chat, one-shot actions, free-form custom prompts; tool-call approval / deny |
| `ProfilesEngine`    | Profile CRUD with uniqueness, credential check, cascade-on-delete, tool-capability probe |
| `AssignmentsEngine` | `ActionType → profileId` resolution, capability-validated bind, cascade-on-delete |
| `ThreadsEngine`     | Thread lifecycle: create, open-or-create with auto title, rename, regenerate title, clear |
| `ToolsEngine`       | Custom MCP servers CRUD + per-tool disabled / auto-approve preferences |
| `PromptsEngine`     | Prompt + folder CRUD with scoped uniqueness, atomic move, versioned import / export |
| `WebSearchEngine`   | Singleton web-search config with live credential validation and atomic switch |
| `PreferencesEngine` | Scalar preferences with default-fallback `get` and idempotent `set` |
| `AttachmentsEngine` | Local-only draft attachments — persists files / images to `storage.attachments` and binds them to messages |

`AIEngine` emits a streaming `AsyncGenerator<ChatEvent>` with these
event types: `user-message-stored`, `message-start`, `message-delta`,
`message-end`, `message-incomplete`, `tool-call-pending`,
`thread-title`.

See [`docs/core/services/README.md`](../docs/core/services/README.md).

## `core/storage/` — `StorageAdapter` contract

The host provides a single `StorageAdapter` aggregating eleven
domain sub-stores: `threads`, `messages`, `profiles`, `assignments`,
`prompts`, `promptFolders`, `mcpServers`, `toolPrefs`, `preferences`,
`webSearch`, `attachments`. Plus `init()` / `close()` lifecycle.

See [`docs/core/storage/README.md`](../docs/core/storage/README.md).

## `core/actions/` — one-shot actions

`chat`, `summarization`, `translation`, `text-analyze`,
`image-generation`, `ocr`, `vision`, `title`, plus `custom`
free-form prompts. Each action resolves a profile via
`AssignmentsEngine`, picks a provider through
`providerFor(actionType)`, and returns a result.

See [`docs/core/actions/README.md`](../docs/core/actions/README.md).

## `core/middleware/` — chat middleware pipeline

`ChatMiddleware` hooks expose extension points around the chat
flow (e.g. `beforeSend`, `afterReceive`). `MiddlewareRunner` runs
them in order around `AIEngine.send*`.

See [`docs/core/middleware/README.md`](../docs/core/middleware/README.md).

## `shared/` — type-only primitives

`provider-type.ts`, `builtin-provider-type.ts`, `model.ts`,
`capabilities.ts`, `capabilities-ui.ts`, `action-type.ts`,
`provider.ts`, `provider-credentials.ts`, `mcp-item.ts`,
`error-data.ts`, `image-generation-args.ts`, `send-message-args.ts`,
`send-message-sync-args.ts`, `settings-adapter.ts`, `images.ts`,
`abort.ts`, `debounce.ts`, `infer-capabilities.ts`, `api-key-links.ts`,
`logger.ts`, `utils.ts`.

The `logger` from [`shared/logger.ts`](shared/logger.ts) is the
only sanctioned wrapper around `console.*` — ESLint's `no-console`
warns on direct use.

See [`docs/shared/README.md`](../docs/shared/README.md).

## `ui/` — React layer

### Pages

`ai-models`, `chat`, `empty-screen`, `initial-setup`, `mcp-servers`,
`model-assignment`, `settings`, `web-search`.

See [`docs/ui/pages.md`](../docs/ui/pages.md).

### Providers

`ApiProvider` (in-process or remote engine routing),
`ComponentsProvider` (override built-in UI primitives),
`EventsProvider` (`ChatCallbacks` + `ChatEventBus`),
`ImagesProvider` (override icons / images),
`ImperativeProvider` (exposes `AIChatWidgetRef`),
`LocalesProvider` (i18next + custom translations),
`PlatformProvider` (`PlatformAdapter`),
`ThemeProvider` (theme tokens, dark/light resolution).

See [`docs/ui/providers/README.md`](../docs/ui/providers/README.md).

### Stores

Zustand: `attachments`, `clouds`, `messages`, `profiles`, `prompts`,
`router`, `servers`, `theme`, `threads`. Created together by
`createStores()` and exposed via `StoresProvider` / `useStores()`.

### Hooks

`useMessages`, `useProfiles`, `useServers`, `useThreads`, plus
`useEnsureProfiles` / `useEnsurePrompts` / `useEnsureThreads` /
`useEnsureTools` (one-shot rehydration) and small helpers
(`useDebouncedCallback`, `useDirection`).

See [`docs/ui/hooks.md`](../docs/ui/hooks.md).

### Tools runtime

`Servers` aggregates two tool sources:

| Source            | Description                                              | Availability |
| ----------------- | -------------------------------------------------------- | ------------ |
| `HostToolSource`  | Host-provided tool groups (`HostToolGroup[]`)            | Always, when passed to `ToolsProvider` |
| `CustomServers`   | MCP servers over JSON-RPC 2.0 (HTTP + STDIO)             | HTTP always; STDIO requires `platform.process` |

Web search is its own engine (`WebSearchEngine`, Exa API) and is
not part of `Servers`.

See [`docs/ui/tools.md`](../docs/ui/tools.md).

## Capabilities & action types

`CapabilitiesUI` is a bitmask:

| Flag         | Value | Description |
| ------------ | ----- | ----------- |
| `None`       | 0x00  | No capabilities |
| `Chat`       | 0x01  | Text chat |
| `Image`      | 0x02  | Image generation |
| `Embeddings` | 0x04  | Text embeddings |
| `Audio`      | 0x08  | Audio (TTS / STT) |
| `Vision`     | 0x80  | Image understanding |
| `Tools`      | 0x100 | Tool / function calling |

`ActionType` values: `Default`, `Chat`, `Code`, `Summarization`,
`Translation`, `TextAnalyze`, `ImageGeneration`, `OCR`, `Vision`.
`AssignmentsEngine` binds each `ActionType` to a `profileId` and
validates the profile's capabilities against the action's
requirement.

## Public entry

The single source of truth for the public surface is
[`index.ts`](index.ts). Subpath imports mirror the layout under
`dist/` — see the `exports` block in
[`package.json`](../package.json) for the full list (`/core`,
`/providers`, `/services`, `/storage`, `/middleware`, `/store`,
`/tools`, `/events`, `/hooks`, `/pages`, `/platform`, `/imperative`,
`/types`, `/styles`, `/styles/themes`).
