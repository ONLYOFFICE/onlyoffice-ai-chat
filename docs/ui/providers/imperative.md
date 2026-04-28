# Imperative API

`AIChatWidget` exposes an imperative ref handle (`AIChatWidgetRef`)
for programmatic control over messages, threads, navigation,
profiles, tool-call approval, and out-of-band re-syncs. Use this
when you want the widget UI but also need to drive it from code
(e.g. a "Summarize" button outside the widget, cross-tab sync).

If you need full control without a UI, use
[headless mode](../headless-usage.md) instead.

## Getting the ref

```tsx
import { useRef } from "react";
import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";

const ref = useRef<AIChatWidgetRef>(null);
<AIChatWidget ref={ref} {...props} />;
```

The ref is null until the widget mounts — always use `?.` or guard.

## Messages

| Method | Signature | Description |
| --- | --- | --- |
| `sendMessage` | `(text, options?: { files?, images? }) => void` | Send a text message programmatically with optional attachments. |
| `stopStreaming` | `() => void` | Cancel the current streaming response. |
| `isStreaming` | `() => boolean` | True while a response is streaming. |

## Threads

| Method | Signature | Description |
| --- | --- | --- |
| `switchThread` | `(threadId) => void` | Switch to an existing thread. |
| `createThread` | `() => string` | Create a new empty thread, switch to it, return the new id. |
| `deleteThread` | `(threadId) => void` | Delete a thread. |
| `renameThread` | `(threadId, title) => void` | Rename a thread. |
| `clearHistory` | `(threadId) => Promise<void>` | Clear all messages in a thread. |
| `downloadThread` | `(threadId) => void` | Download a thread as a file. |
| `getThreads` | `() => Thread[]` | Get all threads. |
| `getCurrentThreadId` | `() => string` | Get the active thread id. |

## Navigation

| Method | Signature | Description |
| --- | --- | --- |
| `openChat` | `() => void` | Navigate to the chat page. |
| `openSettings` | `() => void` | Navigate to the settings page. |
| `openHistory` | `() => void` | Navigate to the thread history page. |
| `getCurrentPage` | `() => Page` | Get the current page id. |

## Profiles

| Method | Signature | Description |
| --- | --- | --- |
| `getProfiles` | `() => Profile[]` | Get all profiles. |
| `setChatProfile` | `(profileId) => void` | Set the active chat profile. No-op if the id is unknown. |
| `getCurrentProfile` | `() => Profile \| null` | Get the active profile or `null`. |

## Tool calls

| Method | Signature | Description |
| --- | --- | --- |
| `approveToolCall` | `(options?: { allowAlways?: boolean }) => void` | Approve the pending tool call. `allowAlways: true` adds the tool to the persistent allow list. |
| `denyToolCall` | `() => void` | Deny the pending tool call. |

## External updates

Use these after the host mutates storage / settings out of band
(another tab, a server-push event, an admin script). They force a
re-read and re-render and emit the matching `ChatCallbacks` event.

| Method | Signature | Description |
| --- | --- | --- |
| `updateProfiles` | `() => Promise<void>` | Re-read the profile list. Emits `onProfilesUpdated`. |
| `updateThreads` | `() => Promise<void>` | Re-read the thread list. Emits `onThreadsUpdated`. |
| `updateCurrentChat` | `() => void` | Re-read the persisted chat profile id. Emits `onCurrentChatProfileUpdated`. |
| `updateModelAssignment` | `() => void` | Re-read every task slot. Emits `onModelAssignmentUpdated` per changed slot. |
| `updateMCPServer` | `() => Promise<void>` | Re-read MCP config and rebuild the tool list. Emits `onServersUpdated`. |
| `updateWebSearch` | `() => void` | Re-read the web-search config. Emits `onWebSearchUpdated`. |
| `updateExtendedThinking` | `() => void` | Re-read the deep-mode flag. Emits `onExtendedThinkingUpdated`. |
| `updateSystemPromptAppendix` | `() => void` | Re-read the appendix and re-apply. Emits `onSystemPromptAppendixUpdated` if changed. |

`update*` methods are unnecessary when the change went through the
widget UI or another `ref` method — those paths already keep
in-memory state in sync.

## System prompt appendix

Free-form text appended (after two newlines) to the built-in system
prompt on every provider request — main chat plus every task slot.
Persists under `storeKeys.systemPromptAppendix`.

| Method | Signature | Description |
| --- | --- | --- |
| `setSystemPromptAppendix` | `(text) => void` | Set or replace the appendix. Empty string is equivalent to `clearSystemPromptAppendix`. |
| `clearSystemPromptAppendix` | `() => void` | Remove the appendix. |
| `getSystemPromptAppendix` | `() => string` | Returns the active appendix or `""`. |

```ts
ref.current?.setSystemPromptAppendix(
  "Always respond in formal Russian. Prefer bullet lists."
);
ref.current?.clearSystemPromptAppendix();
```

The appendix is purely additive — the built-in prompt that governs
tool-call behaviour and conversational defaults is always sent.

## Full example

```tsx
import { useRef, useCallback } from "react";
import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";

export function ChatApp() {
  const ref = useRef<AIChatWidgetRef>(null);

  const summarize = useCallback(() => {
    ref.current?.sendMessage("Summarize the current document");
  }, []);

  const newThread = useCallback(() => {
    const id = ref.current?.createThread();
    console.log("Created thread:", id);
  }, []);

  const stop = useCallback(() => {
    if (ref.current?.isStreaming()) ref.current.stopStreaming();
  }, []);

  return (
    <>
      <nav>
        <button onClick={summarize}>Summarize</button>
        <button onClick={newThread}>New thread</button>
        <button onClick={stop}>Stop</button>
      </nav>
      <AIChatWidget ref={ref} {...props} />
    </>
  );
}
```

The full type definition lives in
[`src/ui/providers/ImperativeProvider/types.ts`](../../../src/ui/providers/ImperativeProvider/types.ts).
