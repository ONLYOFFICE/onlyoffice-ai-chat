# Hooks

Seven React hooks exported from `@onlyoffice/ai-chat/hooks`. Four of
them drive the widget's runtime (lifecycle); three are utilities. All
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
  usePromptHistory,
} from "@onlyoffice/ai-chat/hooks";
```

## Lifecycle hooks

Each takes an `{ isReady }` flag. Pass `true` once `storage.init()`
has resolved (and any host-side migration has finished).

### `useThread({ isReady })`

Loads threads and prompt templates from `StorageAdapter` into
`useThreadsStore` / `usePromptsStore` once `isReady` flips to
`true`. Threads are scoped by
[`WidgetConfig.entityId`](../../src/widget-config.tsx) — when
the host has bound the widget to an entity, only that entity's
threads are loaded; otherwise the unscoped (global / passthrough)
list is loaded. Re-fires when `entityId` changes. Prompts are
not scoped.

- Returns: nothing (side-effect only)
- Required providers: `StoresProvider`, `WidgetConfigProvider`

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
emits every `ChatCallbacks` event. The current
[`WidgetConfig.entityId`](../../src/widget-config.tsx) is forwarded
on every `sendWithStream` / `approveToolCall` / `denyToolCall`
call, so a freshly created thread is bound to the entity and
the chat profile is resolved per-entity (if the host has set
one up).

```ts
const { onNew, regenerate, approveToolCall, denyToolCall } = useMessages({
  isReady,
});
```

| Returned | Description |
| --- | --- |
| `onNew(message)` | Submit a new user message (text + attachments). Same entry point the composer's "Send" uses. |
| `regenerate(parentIndex)` | Re-roll the assistant reply that follows `messages[parentIndex]` (a user message). Wired into the built-in `Reload` button under each assistant message — the host can also call it programmatically. No-ops if a stream is already running, the parent isn't a user message, or there's no active thread. |
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

### `usePromptHistory()`

Terminal-style recall of previously sent prompts, scoped to the
currently open thread so each chat walks back through its own prompts
and a new chat starts empty. Backs the composer's ↑ / ↓ keys; the list
is loaded once per thread and then kept in memory, so walking it never
waits on a round-trip.

A brand-new chat has no thread id until the first send creates one: its
history starts empty, and the prompts typed there are persisted against
the thread that send produces.

```ts
const history = usePromptHistory();

history.previous(currentDraft); // ↑ — one entry towards the past
history.next();                 // ↓ — one entry towards the present
history.record(sentText);       // remember a prompt that was just sent
history.reset();                // abandon the walk (the user edited the draft)
history.isBrowsing;             // walking the list rather than typing
```

`previous` / `next` return `{ text }` for the entry to place in the
input, or `null` when history has nothing to offer — in which case the
caller must leave the key to the textarea so the caret still moves
normally. Stepping forward past the newest entry restores the draft
that was in the box when the walk started.

Persistence comes from the optional
[`promptHistory`](../core/storage/storage.md#prompthistorystorage)
storage slice; without it the history is session-only.

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
