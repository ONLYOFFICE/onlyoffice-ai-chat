# `@onlyoffice/ai-chat` — documentation

Documentation for the headless AI chat widget library: 16 built-in
providers, MCP tool support, pluggable React UI, and a fully
host-driven adapter layer.

The repo is split into three top-level concerns, each with its own
documentation tree:

- **`core/`** — pure business logic (engines, providers, actions,
  storage contract, middleware). Zero React, zero browser-only APIs.
- **`shared/`** — type-only modules used by every layer (no
  dependencies on `core/`, `ui/`, or any framework).
- **`ui/`** — the React layer: pages, hooks, stores, providers,
  events, the platform adapter, the `AIChatWidget` shell.

## Top-level

| Doc | Topic |
| --- | --- |
| [`getting-started.md`](./getting-started.md) | Install, minimal example, framework notes |
| [`architecture.md`](./architecture.md) | Adapter pattern, `AppContext`, layer cake, data flow |
| [`adapters.md`](./adapters.md) | `StorageAdapter` / `SettingsAdapter` / `PlatformAdapter` contracts |
| [`headless-usage.md`](./headless-usage.md) | Using `core/` engines without the widget UI |

## `core/` — engines, providers, storage, actions, middleware

| Doc | Topic |
| --- | --- |
| [`core/services/README.md`](./core/services/README.md) | Eight engine classes — `AIEngine`, `ProfilesEngine`, `AssignmentsEngine`, `ThreadsEngine`, `ToolsEngine`, `PromptsEngine`, `WebSearchEngine`, `PreferencesEngine` |
| [`core/providers/README.md`](./core/providers/README.md) | `AbstractBaseProvider`, registry, 16 built-in providers |
| [`core/storage/README.md`](./core/storage/README.md) | `StorageAdapter` and the ten domain sub-storages |
| [`core/actions/README.md`](./core/actions/README.md) | One-shot actions: chat, summarization, translation, OCR, etc. |
| [`core/middleware/README.md`](./core/middleware/README.md) | `ChatMiddleware` pipeline + `MiddlewareRunner` |

## `shared/` — type-only primitives

| Doc | Topic |
| --- | --- |
| [`shared/README.md`](./shared/README.md) | Provider/model/capability/action types, errors, abort, logger |

## `ui/` — React layer

| Doc | Topic |
| --- | --- |
| [`ui/README.md`](./ui/README.md) | Index of UI docs and how the providers nest |
| [`ui/hooks.md`](./ui/hooks.md) | `useMessages`, `useProfiles`, `useServers`, `useThread`, helpers |
| [`ui/pages.md`](./ui/pages.md) | The seven exported page components |
| [`ui/imperative.md`](./ui/imperative.md) | `AIChatWidgetRef` — programmatic widget control |
| [`ui/providers/events.md`](./ui/providers/events.md) | `ChatCallbacks`, `ChatEventBus`, `CallbacksManager` |
| [`ui/tools.md`](./ui/tools.md) | `ToolsProvider`, `Servers`, `HostToolGroup`, MCP transport |
| [`ui/providers/README.md`](./ui/providers/README.md) | Pluggable React providers — index |
| [`ui/providers/api.md`](./ui/providers/api.md) | `ApiProvider` — in-process or remote engine routing |
| [`ui/providers/components.md`](./ui/providers/components.md) | Override built-in UI primitives |
| [`ui/providers/images.md`](./ui/providers/images.md) | Override icons / images |
| [`ui/providers/locales.md`](./ui/providers/locales.md) | i18n: 43 bundled locales, custom translations |
| [`ui/providers/theme.md`](./ui/providers/theme.md) | Built-in themes, custom tokens, dark/light resolution |

## Public API

The single source of truth for what is exported from the package
is [`src/index.ts`](../src/index.ts). Subpath imports mirror the
folder layout under `dist/`:

```ts
import { AIChatWidget }      from "@onlyoffice/ai-chat";
import { AIEngine }          from "@onlyoffice/ai-chat/services";
import { AbstractBaseProvider } from "@onlyoffice/ai-chat/providers";
import { MiddlewareRunner }  from "@onlyoffice/ai-chat/middleware";
import { createStores }      from "@onlyoffice/ai-chat/store";
import { ToolsProvider }     from "@onlyoffice/ai-chat/tools";
import { EventsProvider }    from "@onlyoffice/ai-chat/events";
import { useMessages }       from "@onlyoffice/ai-chat/hooks";
import { ChatPage }          from "@onlyoffice/ai-chat/pages";
import { PlatformProvider }  from "@onlyoffice/ai-chat/platform";
import type { AIChatWidgetRef } from "@onlyoffice/ai-chat/imperative";
import type { Thread }       from "@onlyoffice/ai-chat/types";
import "@onlyoffice/ai-chat/styles";
import "@onlyoffice/ai-chat/styles/themes";
```
