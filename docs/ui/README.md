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
        WidgetConfigProvider — UI runtime flags (entityId, hideProfilePicker, …)
          ApiProvider         — ServerAPI (in-process or remote engines)
            StoresProvider      — Zustand bundle
              ThemeProvider      — theme + tokens
                ImagesProvider    — icon / image overrides
                  ToolsProvider    — Servers + hostToolGroups + eventBus
                    <Layout/>
```

If you want to mount pages without the widget shell, replicate this
chain — see [`pages.md`](./pages.md).

## Entity-scoped widgets ("rooms")

`WidgetConfig.entityId` binds a widget instance to a host entity
(a document, a channel, a group). The id is opaque — it is
forwarded by the UI layer to every scoped storage call (threads
list, MCP servers, tool prefs, deep-mode preference, web-search
config, and the Chat assignment lookup). Threads created in an
entity-bound widget are tagged with the entity and won't appear
in the unscoped sidebar; the `Default` profile fallback is
intentionally global so a room without its own configuration
keeps working. The value is fixed at mount — switching entity
requires re-mounting the widget. See
[`docs/core/storage/storage.md`](../core/storage/storage.md#entity-scoping-entityid)
for the persistence contract.

## Runtime flags (`WidgetConfig`)

[`WidgetConfig`](../../src/widget-config.tsx) is the bag of UI runtime
flags read through `useWidgetConfig()`. Most fields are simple
toggles (`hideProfilePicker`, `hideSettingsButton`,
`isDialogFullscreen`, …); two are extension points worth calling out:

- **`assistantActions: AssistantAction[]`** — extra buttons rendered
  under every assistant message, appended after the built-in Copy and
  Save. Each action's `onClick` receives `{ text, markdown, message }`
  of the assistant reply. Hidden during streaming and on error states.
- **`composerActions: ComposerAction[]`** — extra items appended to
  the composer's `+` (attachments) dropdown, rendered above the
  built-in Web Search / Extended Thinking block. Items are
  onClick-only (`{ id, text, icon?, onClick }`); toggles and submenus
  are not supported. The dropdown's leading separator is suppressed
  automatically when nothing renders above it (no `platform.file` and
  no `composerActions`).

```tsx
<AIChatWidget
  assistantActions={[
    {
      id: "insert",
      tooltip: "Insert into document",
      icon: "btn-copy",
      onClick: ({ text }) => host.insertText(text),
    },
  ]}
  composerActions={[
    {
      id: "snippets",
      text: "Snippets",
      icon: "btn-copy",
      onClick: () => host.openSnippetsPicker(),
    },
  ]}
/>
```

`icon` accepts a built-in `IconName`, a custom registered icon name
(see [`providers/images.md`](./providers/images.md)), or a React
node.

### Overriding the in-chat error box (`formatChatError`)

The box renders a title, a description, and a **Retry** button. Retry
replays the errored turn through the regenerate path: the failed
assistant message is dropped and the last user message is re-run from
stored history, so nothing is appended to the thread and the box
disappears. (Sending from the composer is unaffected — a new message
still lands after the error.)

By default the title is the localized `ChatError.<code>` string (or the
provider's `payload.message` for an unrecognized code) and the
description is the error code.

- **`formatChatError(payload, ctx)`** — rewrites those slots as plain
  text. Receives the normalized
  [`ChatErrorPayload`](../core/services/README.md) and
  `{ threadId?, defaultTitle, defaultDescription }`. Return a
  `ChatErrorOverride`; every field is optional and an omitted one keeps
  the default. Return `null` / `undefined` for the codes you don't
  handle. The box itself — layout, fill, `role="alert"` — stays
  library-owned, so a host cannot break the chat's appearance, and a
  throw is caught and logged.

Branch on `payload.code`, never on the provider's message text. The
codes are the canonical set `toChatError` produces — `"auth"`,
`"model_not_found"`, `"rate_limit"`, `"timeout"`, `"network"`,
`"bad_request"`, `"server"`, `"not_found"`, `"insufficient_funds"`,
`"aborted"`, `"unknown"` — plus any provider-specific string an SDK
supplies verbatim.

```tsx
<AIChatWidget
  formatChatError={(payload) =>
    payload.code === "insufficient_funds"
      ? {
          title: t("WalletEmpty"),
          description: t("TopUpToContinue"),
          action: { text: t("TopUp"), onClick: () => goToWallet() },
        }
      : null
  }
/>
```

The `action` field carries four distinct intents:

| `action` | Result |
| --- | --- |
| omitted | the default Retry |
| `null` | no button — for errors a retry cannot fix |
| `{ text }` | Retry's behavior under a different label |
| `{ onClick }` | the host's own action instead of a retry |

`ctx.defaultTitle` / `ctx.defaultDescription` carry what the widget
would have shown, so a host can decorate instead of replacing:

```tsx
formatChatError={(payload, { defaultTitle }) =>
  payload.code === "rate_limit"
    ? { title: `${defaultTitle} (${payload.code})` }
    : null
}
```

The same structured code reaches the `onStreamError` callback as
`error.code`, for hosts that only need to react (telemetry, a toast)
rather than change the box.

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
