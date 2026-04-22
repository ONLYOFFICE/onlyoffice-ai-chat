# Imperative API

`AIChatWidget` exposes an imperative ref handle (`AIChatWidgetRef`) for programmatic control over messages, threads, navigation, profiles, and tool-call approval.

## Getting the Ref

```tsx
import { useRef } from "react";
import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";

function App() {
  const ref = useRef<AIChatWidgetRef>(null);

  return (
    <AIChatWidget
      ref={ref}
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={keys}
    />
  );
}
```

## API Reference

### Messages

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendMessage` | `(text: string, options?: { files?: TAttachmentFile[]; images?: TAttachmentImage[] }) => void` | Send a text message programmatically, optionally with file or image attachments. |
| `stopStreaming` | `() => void` | Cancel the current streaming response. |
| `isStreaming` | `() => boolean` | Returns `true` if a response is currently being streamed. |

### Threads

| Method | Signature | Description |
|--------|-----------|-------------|
| `switchThread` | `(threadId: string) => void` | Switch to an existing thread by ID. |
| `createThread` | `() => string` | Create a new empty thread and switch to it. Returns the new thread ID. |
| `deleteThread` | `(threadId: string) => void` | Delete a thread by ID. |
| `renameThread` | `(threadId: string, title: string) => void` | Rename a thread. |
| `clearHistory` | `(threadId: string) => Promise<void>` | Clear all messages in a thread. |
| `downloadThread` | `(threadId: string) => void` | Download a thread as a file. |
| `getThreads` | `() => Thread[]` | Get all threads. |
| `getCurrentThreadId` | `() => string` | Get the current active thread ID. |

### Navigation

| Method | Signature | Description |
|--------|-----------|-------------|
| `openChat` | `() => void` | Navigate to the chat page. |
| `openSettings` | `() => void` | Navigate to the settings page. |
| `openHistory` | `() => void` | Navigate to the thread history page. |
| `getCurrentPage` | `() => Page` | Get the current page (`"chat"`, `"settings"`, `"history"`, `"initial-setup"`). |

### Profiles

| Method | Signature | Description |
|--------|-----------|-------------|
| `getProfiles` | `() => Profile[]` | Get all configured profiles. |
| `setChatProfile` | `(profileId: string) => void` | Set the active chat profile by ID. |
| `getCurrentProfile` | `() => Profile \| null` | Get the currently active chat profile, or `null`. |

### Tool Calls

| Method | Signature | Description |
|--------|-----------|-------------|
| `approveToolCall` | `(options?: { allowAlways?: boolean }) => void` | Approve a pending tool call. Pass `{ allowAlways: true }` to auto-approve future calls from the same tool. |
| `denyToolCall` | `() => void` | Deny a pending tool call. |

### External Updates

Use these when the host mutates storage or settings out of band (e.g. a Node.js admin tool edits IndexedDB, another tab changes `localStorage`, or a server-push event invalidates the cache). Calling an `update*` method forces the widget to re-read the corresponding slice and re-render any currently-open page with the fresh state.

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateProfiles` | `() => Promise<void>` | Re-read the full profile list from `StorageAdapter`. Emits `onProfilesUpdated`. |
| `updateThreads` | `() => Promise<void>` | Re-read the thread list from `StorageAdapter`. Emits `onThreadsUpdated`. |
| `updateCurrentChat` | `() => void` | Re-read the persisted chat profile ID from `SettingsAdapter` (key: `storeKeys.chatProfile`) and re-apply it. Emits `onCurrentChatProfileUpdated`. |
| `updateModelAssignment` | `() => void` | Re-read the `default` profile plus all 7 task-profile assignments (`chat`, `summarization`, `translation`, `textAnalysis`, `imageGeneration`, `ocr`, `vision`). Emits `onModelAssignmentUpdated` for each changed slot. |
| `updateMCPServer` | `() => Promise<void>` | Re-read MCP server config from `SettingsAdapter` (key: `storeKeys.mcpServers`) and rebuild the tool list. Emits `onServersUpdated`. |
| `updateWebSearch` | `() => void` | Re-read the Web Search configuration (provider, API key, cloud flag). Emits `onWebSearchUpdated`. |
| `updateExtendedThinking` | `() => void` | Re-read the "extended thinking" / deep-mode flag from settings (key: `storeKeys.deepMode`). Emits `onExtendedThinkingUpdated`. |
| `updateSystemPromptAppendix` | `() => void` | Re-read the system-prompt appendix from settings (key: `storeKeys.systemPromptAppendix`), re-apply it to every active provider, and emit `onSystemPromptAppendixUpdated` if the value changed. |

### System Prompt Appendix

Append free-form text to the library's built-in system prompt without replacing it. The appendix is appended (after two newlines) to the default `SYSTEM_PROMPT` and used for every provider request — the main chat provider as well as each task slot (summarization, translation, OCR, etc.) — until cleared. Persists to `SettingsAdapter` under `storeKeys.systemPromptAppendix`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `setSystemPromptAppendix` | `(text: string) => void` | Set or replace the appendix. Persists, re-applies to all providers, and emits `onSystemPromptAppendixUpdated`. Passing an empty string behaves like `clearSystemPromptAppendix`. |
| `clearSystemPromptAppendix` | `() => void` | Remove the appendix. Providers revert to the built-in system prompt alone. Emits `onSystemPromptAppendixUpdated` with `appendix: ""`. |
| `getSystemPromptAppendix` | `() => string` | Returns the currently active appendix, or `""` when unset. |

```tsx
// Add a company-wide tone override on top of the built-in prompt.
ref.current?.setSystemPromptAppendix(
  "Always respond in formal Russian. Prefer bullet lists over prose."
);

// Reset to the built-in prompt.
ref.current?.clearSystemPromptAppendix();
```

The appendix is a pure **addition** — the built-in system prompt (which governs tool-call behavior, conversational defaults, etc.) is always sent. Use the appendix for tone, language preferences, domain constraints, or any instructions layered on top of the default. Empty or whitespace-only strings are treated as no appendix.

```tsx
// Host mutated IndexedDB directly — tell the widget to catch up.
await myBackend.upsertProfile(profile);
await chatRef.current?.updateProfiles();
```

```tsx
// Cross-tab sync: a BroadcastChannel message signals a settings change.
channel.onmessage = (e) => {
  if (e.data.type === "mcp-changed") void chatRef.current?.updateMCPServer();
  if (e.data.type === "web-search") chatRef.current?.updateWebSearch();
};
```

## Full Example

```tsx
import { useRef, useCallback } from "react";
import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";

function ChatApp() {
  const ref = useRef<AIChatWidgetRef>(null);

  const handleSummarize = useCallback(() => {
    ref.current?.sendMessage("Summarize the current document");
  }, []);

  const handleNewThread = useCallback(() => {
    const threadId = ref.current?.createThread();
    console.log("Created thread:", threadId);
  }, []);

  const handleSwitchToSettings = useCallback(() => {
    ref.current?.openSettings();
  }, []);

  const handleStop = useCallback(() => {
    if (ref.current?.isStreaming()) {
      ref.current.stopStreaming();
    }
  }, []);

  const handleApprove = useCallback(() => {
    ref.current?.approveToolCall({ allowAlways: true });
  }, []);

  return (
    <div>
      <nav>
        <button onClick={handleSummarize}>Summarize</button>
        <button onClick={handleNewThread}>New Thread</button>
        <button onClick={handleSwitchToSettings}>Settings</button>
        <button onClick={handleStop}>Stop</button>
        <button onClick={handleApprove}>Approve Tool</button>
      </nav>

      <AIChatWidget
        ref={ref}
        storage={storage}
        settings={settings}
        platform={platform}
        storeKeys={keys}
      />
    </div>
  );
}
```

## Notes

- The ref is populated after the widget mounts. Always use optional chaining (`ref.current?.method()`) or guard with a null check.
- `sendMessage` triggers the same flow as a user typing and submitting -- the message appears in the UI and the AI responds.
- `clearHistory` is async because it persists the change to storage.
- `setChatProfile` is a no-op if the given profile ID does not exist.
- `update*` methods are only needed when the host mutates storage/settings *without* going through the widget. Changes made via the widget UI or other imperative methods are already reflected — calling `update*` after them is redundant.
