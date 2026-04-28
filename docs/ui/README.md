# `ui/` — React layer

Everything React-flavoured: the `AIChatWidget` shell, page
components, hooks, Zustand stores, the platform adapter, the
events bus, the tools system, and a stack of pluggable providers
for theming, i18n, components, images, and remote-engine routing.

`ui/` depends on `core/` and `shared/`. It is the only layer that
imports React.

## Per-topic docs

| Doc | Topic |
| --- | --- |
| [`hooks.md`](./hooks.md) | Lifecycle hooks (`useMessages`, `useProfiles`, `useServers`, `useThread`) and helpers |
| [`pages.md`](./pages.md) | Seven exported page components and how to mount them standalone |
| [`providers/imperative.md`](./providers/imperative.md) | `AIChatWidgetRef` — programmatic widget control |
| [`providers/events.md`](./providers/events.md) | `ChatCallbacks`, `ChatEventBus`, `CallbacksManager` |
| [`tools.md`](./tools.md) | `ToolsProvider`, `Servers`, `HostToolGroup`, MCP transport |
| [`providers/README.md`](./providers/README.md) | Pluggable React providers — index |

## Provider chain inside `AIChatWidget`

When you render `AIChatWidget`, the following chain is set up
automatically (top → outermost):

```
EventsProvider           — CallbacksManager + ChatCallbacks props
  PlatformProvider        — PlatformAdapter
    I18nProvider           — locale + translations
      ComponentsProvider    — UI primitive overrides
        WidgetConfigProvider — UI runtime flags (hideProfilePicker, …)
          ApiProvider         — ServerAPI (in-process or remote engines)
            StoresProvider      — Zustand bundle
              ThemeProvider      — theme + tokens
                ImagesProvider    — icon / image overrides
                  ToolsProvider    — Servers + hostToolGroups + eventBus
                    <Layout/>
```

If you want to mount pages without the widget shell, replicate this
chain — see [`pages.md`](./pages.md).

## What is exported, and from where

The public surface lives in [`src/index.ts`](../../src/index.ts).
Every UI symbol is also reachable through a subpath:

```ts
import { ChatPage, SettingsPage }     from "@onlyoffice/ai-chat/pages";
import { useMessages, useProfiles }   from "@onlyoffice/ai-chat/hooks";
import { ToolsProvider, Servers }     from "@onlyoffice/ai-chat/tools";
import { EventsProvider, CallbacksManager } from "@onlyoffice/ai-chat/events";
import { PlatformProvider }           from "@onlyoffice/ai-chat/platform";
import { createStores, useStores }    from "@onlyoffice/ai-chat/store";
import type { AIChatWidgetRef }       from "@onlyoffice/ai-chat/imperative";
```

`SettingsAdapter` lives in `shared/` (it is a pure type) and
`StorageAdapter` lives in `core/`, so neither gets a `ui/` doc.
