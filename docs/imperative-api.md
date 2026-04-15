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
