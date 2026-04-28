# Hooks

Six React hooks exported from `@onlyoffice/ai-chat/hooks`. Four of
them drive the widget's runtime (lifecycle); two are utilities. All
hooks read state via `useStores()` and so must be rendered inside a
`StoresProvider` (plus `ToolsProvider` for `useServers`).

Inside `AIChatWidget` they are mounted automatically. Use them
directly only when building a custom shell — see
[`pages.md`](./pages.md) for the surrounding provider stack.

```ts
import {
  useMessages,
  useProfiles,
  useServers,
  useThread,
  useDirection,
  useDebouncedCallback,
} from "@onlyoffice/ai-chat/hooks";
```

## Lifecycle hooks

Each takes an `{ isReady }` flag. Pass `true` once `storage.init()`
has resolved (and any host-side migration has finished).

### `useThread({ isReady })`

Loads threads and prompt templates from `StorageAdapter` into
`useThreadsStore` / `usePromptsStore` once `isReady` flips to
`true`.

- Returns: nothing (side-effect only)
- Required providers: `StoresProvider`

### `useProfiles({ isReady })`

Loads profiles from `StorageAdapter` into `useProfilesStore` and
restores per-`ActionType` profile assignments via
`AssignmentsEngine`.

- Returns: nothing (side-effect only)
- Required providers: `StoresProvider`, `ApiProvider`

### `useServers({ isReady })`

Boots the MCP server runtime, syncs `hostToolGroups` from
`ToolsProvider` into the `HostToolSource`, polls `getTools()` every
five minutes, and rebuilds the tool list when the event bus fires
`"tools-changed"` (emitted by `CustomServers`, `WebSearch`, and
`ImageGeneration`).

- Returns: nothing (side-effect only)
- Required providers: `StoresProvider`, `ToolsProvider`

### `useMessages({ isReady })`

The core chat loop. Drives `AIEngine.sendStream`, renders streaming
chunks into `useMessageStore`, persists messages to
`StorageAdapter.messages`, orchestrates tool-call approval, and
emits every `ChatCallbacks` event.

```ts
const { onNew, approveToolCall, denyToolCall } = useMessages({ isReady });
```

| Returned | Description |
| --- | --- |
| `onNew(message)` | Submit a new user message (text + attachments). Same entry point the composer's "Send" uses. |
| `approveToolCall(allowAlways?)` | Approve the pending tool call. Pass `true` to add it to the persistent allow list. |
| `denyToolCall()` | Deny the pending tool call and continue the conversation. |

- Required providers: `StoresProvider`, `EventsProvider`, `ApiProvider`

## Utility hooks

### `useDebouncedCallback(callback, delay)`

Returns a stable debounced function with a `.cancel()` method that
is auto-cancelled on unmount.

```tsx
const onSearch = useDebouncedCallback(
  (q: string) => performSearch(q),
  300
);
<input onChange={(e) => onSearch(e.target.value)} />;
```

### `useDirection()`

Returns `{ isRTL, direction }` derived from the active locale.

> Deprecated. `useI18n()` already exposes `isRTL` and `direction`
> alongside the full translation API. See
> [`providers/locales.md`](./providers/locales.md).

## Context accessor hooks

These are not exported from `@onlyoffice/ai-chat/hooks` but are
exposed on the providers themselves. They are the supported way to
pull a context value from consumer code.

| Hook | Returns | Provided by |
| --- | --- | --- |
| `useStores()` | Full store bundle + selectors | `StoresProvider` |
| `usePlatform()` | `PlatformAdapter` | `PlatformProvider` |
| `useToolsContext()` | `{ servers, hostToolGroups, eventBus }` | `ToolsProvider` |
| `useI18n()` | `{ t, locale, isRTL, direction, changeLocale, … }` | `I18nProvider` |
| `useTheme()` | `{ themeId, themeType, setTheme, … }` | `ThemeProvider` |
| `useComponents()` | Resolved `ComponentOverrides` | `ComponentsProvider` |
| `useImages()` | `{ getImageSrc, getIconComponent, … }` | `ImagesProvider` |
| `useCallbacksManager()` | `CallbacksManager` | `EventsProvider` |
| `useWidgetConfig()` | `WidgetConfig` (UI runtime flags) | `WidgetConfigProvider` |
| `useApi()` | `ServerAPI` | `ApiProvider` |
