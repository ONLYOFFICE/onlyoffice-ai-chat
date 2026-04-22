# Hooks

`@onlyoffice/ai-chat` exports a handful of React hooks that implement the core runtime behavior of the widget: message lifecycle, profile/thread initialization, MCP tool sync, and drag-and-drop attachments. They are intended for consumers who are building a custom shell around the library's stores and pages (see [Headless Usage](headless-usage.md)) — inside `AIChatWidget` they are mounted automatically.

All hooks read from Zustand stores via `useStores()` and therefore must be rendered inside a `StoresProvider` (plus `ToolsProvider` where noted).

## Lifecycle hooks

These four hooks drive the widget's startup sequence. Each takes an `isReady` flag — pass `true` after storage has been initialized.

### `useThread({ isReady })`

Loads threads and prompt templates from `StorageAdapter` into `useThreadsStore` / `usePromptsStore` once, when `isReady` flips to `true`.

- Returns: `{}` (side-effect only)
- Depends on: `StoresProvider`

### `useProfiles({ isReady })`

Loads profiles from `StorageAdapter` into `useProfilesStore` and restores the persisted profile→task assignments.

- Returns: `{}` (side-effect only)
- Depends on: `StoresProvider`, `SettingsProvider` (reads profile-assignment keys)

### `useServers({ isReady })`

Boots the MCP server runtime, syncs `hostToolGroups` from `ToolsProvider` into the `HostToolSource`, polls `getTools()` every 5 minutes, and re-builds the tool list whenever the event bus fires `"tools-changed"` (emitted by `CustomServers`, `WebSearch`, and `ImageGeneration`).

- Returns: `{}` (side-effect only)
- Depends on: `StoresProvider`, `ToolsProvider`

### `useMessages({ isReady })`

The core chat loop. Drives `ChatEngine.sendMessage`, renders streaming chunks into `useMessageStore`, auto-persists messages to `StorageAdapter.messages`, orchestrates tool-call approval, and emits every callback in `ChatCallbacks`.

- Returns:
  - `onNew(message: AppendMessage)` — submit a new user message (text + attachments). This is the same entry point `<AIChatWidget>` uses internally when the user hits "Send".
  - `approveToolCall(allowAlways?: boolean)` — approve the pending tool call; pass `true` to add the tool to the persistent "always allow" list.
  - `denyToolCall()` — deny the pending tool call and continue the conversation.
- Depends on: `StoresProvider`, `EventsProvider`

## Utility hooks

### `useDebouncedCallback(callback, delay)`

Returns a stable debounced version of `callback` that fires at most once per `delay` ms. The returned function has a `.cancel()` method and is automatically cancelled on unmount.

```tsx
import { useDebouncedCallback } from "@onlyoffice/ai-chat";

const onSearch = useDebouncedCallback((query: string) => {
  performSearch(query);
}, 300);

<input onChange={(e) => onSearch(e.target.value)} />;
```

### `useDirection()`

Returns `{ isRTL, direction }` derived from the active locale.

> **Deprecated.** Use `useI18n()` directly — it already exposes `isRTL` and `direction` (and the full translation API).

### `useChatDropAttachments()`

Drag-and-drop handlers for attaching files and images to the chat composer from outside the dedicated attach button. Images are read via `readAsDataURL` and pushed into `useAttachmentsStore.addAttachmentImage`; text-like files (by MIME type or by a well-known extension allowlist — `.txt`, `.md`, `.csv`, `.json`, `.ts`, `.py`, `.yaml`, `.sql`, `.sh`, …) are read via `readAsText` and pushed into `addAttachmentFile` with `type: 0`.

Binary formats (`.docx`, `.xlsx`, `.pdf`, `.djvu`, …) are ignored on drop — those still require the host's `PlatformAdapter.file.convertFileToText` and must be attached via the composer button.

Mount the handlers on whichever wrapper should be the drop zone and render the `isDragOver` state for visual feedback:

```tsx
import { useChatDropAttachments } from "@onlyoffice/ai-chat/hooks";

function ChatDropZone({ children }) {
  const { isDragOver, handlers } = useChatDropAttachments();

  return (
    <div
      {...handlers}
      style={{ position: "relative", height: "100%" }}
    >
      {children}
      {isDragOver ? (
        <div className="drop-overlay">Drop files to attach</div>
      ) : null}
    </div>
  );
}
```

- Returns: `{ isDragOver: boolean; handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } }`
- Depends on: `StoresProvider`

## Context hooks

In addition to the runtime hooks above, every context provider exposes a matching accessor hook. These are thin — they just pull the current value out of React context — but they are the supported way to read those values from consumer code.

| Hook | Returns | Provided by |
|------|---------|-------------|
| `useStores()` | `Stores` bundle (all Zustand stores + `chatEngine`, `callbacksManager`, `middlewareRunner`, `selectCurrentChatProfile`) | `StoresProvider` |
| `useSettings()` | `SettingsAdapter` | `SettingsProvider` |
| `useStorage()` | `StorageAdapter` (plus `getStorageInstance()` for non-React callers) | `StorageProvider` |
| `usePlatform()` | `PlatformAdapter` | `PlatformProvider` |
| `useToolsContext()` | `{ servers, hostToolGroups, eventBus }` | `ToolsProvider` |
| `useI18n()` | `{ t, locale, isRTL, direction, changeLocale, ... }` | `I18nProvider` |
| `useTheme()` | `{ theme, setTheme, tokens, ... }` | `ThemeProvider` |
| `useComponents()` | Resolved `ComponentOverrides` (built-in fallbacks merged with user overrides) | `ComponentsProvider` |
| `useImages()` | `{ getImage(name), ... }` | `ImagesProvider` |
| `useCallbacksManager()` | `CallbacksManager` | `EventsProvider` |
| `useWidgetConfig()` | `WidgetConfig` (all UI flags: `hideProfilePicker`, `hideSettingsButton`, `onSettingsClick`, `isSettingsActive`, `isDialogFullscreen`) | `WidgetConfigProvider` |
