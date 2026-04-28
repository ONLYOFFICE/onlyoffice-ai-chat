# Architecture

How the pieces fit. Read this after
[`getting-started.md`](./getting-started.md) and before diving into
the per-folder docs under [`core/`](./core/) and [`ui/`](./ui/).

## Three-layer split

```
┌─────────────────────────────────────────────────────────────────┐
│ ui/                                                             │
│   AIChatWidget shell · pages · hooks · stores · providers ·     │
│   events · platform adapter · tools                             │
└────────────┬────────────────────────────────────────────────────┘
             │ depends on
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ core/                                                           │
│   engines (services/) · providers/ · actions/ · storage/        │
│   middleware/ · capabilities · types                            │
└────────────┬────────────────────────────────────────────────────┘
             │ depends on (type-only)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ shared/                                                         │
│   provider/model/action/capability types · error · abort ·      │
│   logger · settings adapter contract                            │
└─────────────────────────────────────────────────────────────────┘
```

`shared/` is type-only and depends on nothing. `core/` is pure
business logic and is browser-and-server safe. `ui/` is the React
shell and the only layer that imports React.

## Adapter pattern (DI via React context)

The library never imports a concrete persistence engine, settings
backend, or platform capability. Three adapter interfaces are
injected via props and threaded through context:

```
┌──────────────────────────────────────────────────┐
│  AIChatWidget props                              │
│   storage  : StorageAdapter   (host-supplied)    │
│   settings : SettingsAdapter  (host-supplied)    │
│   platform : PlatformAdapter  (host-supplied)    │
└──────────────────────────────────────────────────┘
                      │
                      ▼
   PlatformProvider · ApiProvider · StoresProvider · …
                      │
                      ▼
   Pages, hooks, and engines read via:
     usePlatform() · useStores() · useApi()
```

Same widget, different host: swap adapters. See
[`adapters.md`](./adapters.md) for the contracts.

## `AppContext` — the DI container

Each widget instance owns one `AppContext`, an immutable bundle of
runtime dependencies:

```ts
interface AppContext {
  platform: PlatformAdapter;
  storage: StorageAdapter;
  servers: Servers;
  eventBus: ChatEventBus;
  callbacksManager: CallbacksManager;
  middlewareRunner: MiddlewareRunner;
  onlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
}
```

(See [`src/app-context.ts`](../src/app-context.ts).)

`AppContext` is built once inside `AIChatWidget` (synchronously
inside `useMemo`, not in `useEffect`) and threaded into:

- `createStores({ keys, ctx, api })` — the Zustand bundle
- `Servers` — unified tool system
- All eight engines via the `ApiProvider`

There is no global singleton. Two widgets on the same page have
two independent `AppContext` instances.

`SettingsAdapter` is **not** part of `AppContext` — it is consumed
locally by `Servers` (auto-allow list) and the widget shell.
Persistence routes through `storage` (preferences, MCP servers,
tool prefs, …).

## `core/services` — engines

Eight engines orchestrate business logic between actions, providers,
and storage. Each takes a single `{ storage, … }` deps object and
holds no per-call state.

| Engine | Responsibility |
| --- | --- |
| `AIEngine` | Streaming chat, one-shot actions, free-form custom prompts |
| `ProfilesEngine` | Profile CRUD, credential check, cascade-on-delete |
| `AssignmentsEngine` | `ActionType → profileId` resolution, capability validation |
| `ThreadsEngine` | Thread lifecycle, auto-titling, history clear |
| `ToolsEngine` | Custom MCP servers + per-tool disabled / auto-approve prefs |
| `PromptsEngine` | Prompts and folders, scoped uniqueness, import/export |
| `WebSearchEngine` | Singleton web-search config + live credential check |
| `PreferencesEngine` | Scalar preferences with default-fallback get |

See [`core/services/README.md`](./core/services/README.md) for the
detailed reference.

## Provider system

All AI providers extend `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>`
and are looked up through a unified registry:

```ts
import { getProvider, registerProvider } from "@onlyoffice/ai-chat/providers";

const p = getProvider("openai");        // built-in
registerProvider("my-llm", MyLLMProvider);
const q = getProvider("my-llm");        // custom
```

Sixteen built-in providers ship in `core/providers/`. Each provider
is a stateless thin client over its SDK — credentials and state are
threaded in per call. See
[`core/providers/README.md`](./core/providers/README.md).

## Tool system (`ui/tools/Servers`)

Four tool sources are unified by the `Servers` class. It lives in
`ui/tools/` because it consumes `PlatformAdapter` and the React
event bus, but the engines treat it as a generic `ToolDispatcher`
through the `core/services/tools` boundary.

```
Servers
├── HostToolSource   — tools from the embedding app (PlatformHostTools)
├── WebSearch        — Exa / ONLYOFFICE web search (always auto-allowed)
├── ImageGeneration  — built-in `generate_image` (always auto-allowed)
└── CustomServers    — MCP servers via JSON-RPC 2.0 (HTTP / STDIO)
```

See [`ui/tools.md`](./ui/tools.md) for the full surface and
[`core/services/tools-engine.md`](./core/services/tools-engine.md)
for the persistence side (custom MCP server CRUD + tool prefs).

## Capabilities

Each `Model` declares a `CapabilitiesUI` bitmask (Chat, Image,
Vision, Tools, OCR, …). `AssignmentsEngine` refuses to bind a
profile to an `ActionType` whose capabilities the profile's model
doesn't satisfy. UI uses the same flags to filter profile pickers
per action.

## Stores (`ui/store`)

`createStores({ keys, ctx, api })` returns a typed bundle of Zustand
stores plus the `ServerAPI` slice that pages and hooks read through.
Each widget instance gets its own bundle; nothing is global.

Public store states are exported as types:
`MessageStoreState`, `ProfilesStoreState`, `ThreadsStoreState`,
`ServersStoreState`, `PromptsStoreState`, `AttachmentsStoreState`,
`ThemeStoreState`, `RouterStoreState`.

## Events and middleware

Two complementary mechanisms:

- `ChatCallbacks` — observational callbacks the host registers via
  the `callbacks` prop. Run after the fact, can never modify state.
  See [`ui/events.md`](./ui/events.md).
- `ChatMiddleware` — interceptor pipeline. Six hooks
  (`beforeSend`, `onStreamChunk`, `beforeToolCall`,
  `afterToolResult`, `beforeDisplay`, `onError`) that can block,
  modify, or short-circuit. See
  [`core/middleware/README.md`](./core/middleware/README.md).

`ChatEventBus` is internal pub/sub for fire-and-forget signals
(`"tools-changed"`, etc.) — not for consumer use.

## Data flow — one user message

```
1. User submits in composer
     │
2. useMessages.onNew(append)  ─── ui/hooks
     │
3. middlewareRunner.runBeforeSend(ctx)
     │   block? → done
     │   modify? → continue with new text/files/images
     │
4. AIEngine.sendStream(...)   ─── core/services/ai
     │   loads thread + assignment, picks profile
     │   calls action via core/actions/chat
     │
5. action → AbstractBaseProvider.sendMessage(...)
     │   AsyncGenerator<chunk | toolCall>
     │
6. For each chunk:
     ├── middlewareRunner.runOnStreamChunk(ctx)
     ├── store.appendDelta()
     └── callbacksManager.emit("onStreamDelta")
     │
7. If toolCall:
     ├── middlewareRunner.runBeforeToolCall(ctx) — deny / approve / modify args
     ├── Servers.checkAllowAlways(type, name)
     │   ├── auto-approve  → Servers.callTools()
     │   └── needs approval → emit "onToolCallPending" → wait
     ├── middlewareRunner.runAfterToolResult(ctx)
     └── provider continues generation
     │
8. Stream ends:
     ├── middlewareRunner.runBeforeDisplay(ctx)
     ├── storage.messages.create(...)
     └── callbacksManager.emit("onStreamEnd", "onMessageSent")
     │
9. ThreadsEngine auto-generates title (async)
     └── callbacksManager.emit("onThreadsUpdated", { kind: "renamed" })
```

## Where things live (paths)

| Concept | Source |
| --- | --- |
| Public API entry | [`src/index.ts`](../src/index.ts) |
| `AIChatWidget` shell | [`src/AIChatWidget.tsx`](../src/AIChatWidget.tsx) |
| `AppContext` | [`src/app-context.ts`](../src/app-context.ts) |
| Engines | [`src/core/services/`](../src/core/services/) |
| Providers | [`src/core/providers/`](../src/core/providers/) |
| Storage contract | [`src/core/storage/`](../src/core/storage/) |
| Middleware | [`src/core/middleware/`](../src/core/middleware/) |
| Hooks | [`src/ui/hooks/`](../src/ui/hooks/) |
| Pages | [`src/ui/pages/`](../src/ui/pages/) |
| Stores | [`src/ui/store/`](../src/ui/store/) |
| Tools (`Servers`) | [`src/ui/tools/`](../src/ui/tools/) |
| Imperative ref | [`src/ui/imperative/`](../src/ui/imperative/) |
| Pluggable React providers | [`src/ui/providers/`](../src/ui/providers/) |
| Translations | [`src/translations/`](../src/translations/) |
| Type-only primitives | [`src/shared/`](../src/shared/) |
