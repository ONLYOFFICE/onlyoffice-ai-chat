# Events

Two complementary event systems live under `ui/providers/EventsProvider/`:

- **`ChatCallbacks`** — host-facing observation hooks (run via the
  `callbacks` prop on `AIChatWidget` or via `EventsProvider`). They
  are passive: they cannot block, modify, or delay anything.
- **`ChatEventBus`** — internal pub/sub used between decoupled
  parts of the widget. Not for consumer code.

For interception (block, modify, retry, fall back), use middleware
instead — see [`../../core/middleware/README.md`](../../core/middleware/README.md).

```ts
import {
  CallbacksManager,
  EventsProvider,
  ChatEventBus,
  useCallbacksManager,
} from "@onlyoffice/ai-chat/events";
import type { ChatCallbacks } from "@onlyoffice/ai-chat/events";
```

## `ChatCallbacks`

Pass via the `callbacks` prop on `AIChatWidget`:

```tsx
const callbacks: ChatCallbacks = {
  onMessageSent:  (e) => analytics.track("msg", { thread: e.threadId }),
  onStreamEnd:    (e) => analytics.track("done", { thread: e.threadId }),
  onToolCallResult:(e) => console.log(`Tool ${e.toolName} →`, e.result),
  onError:        (e) => errorReporter.capture(e.error, { type: e.type }),
};

<AIChatWidget callbacks={callbacks} {...props} />;
```

Errors thrown from a callback are silently swallowed by
`CallbacksManager` so they never break internal flow.

### Messages (6)

| Callback | Event | Trigger |
| --- | --- | --- |
| `onMessageSent` | `MessageSentEvent` | User sends a message |
| `onStreamStart` | `StreamStartEvent` | Provider starts streaming |
| `onStreamDelta` | `StreamDeltaEvent` | Each incremental chunk |
| `onStreamEnd` | `StreamEndEvent` | Stream completes successfully |
| `onStreamError` | `StreamErrorEvent` | Stream error — `error.code` carries the machine-readable `ChatErrorPayload` code (branch on it, not on `error.message`) |
| `onStreamStop` | `StreamStopEvent` | User cancels stream |

### Tool calls (5)

| Callback | Event | Trigger |
| --- | --- | --- |
| `onToolCallPending` | `ToolCallPendingEvent` | Awaiting user approval |
| `onToolCallApproved` | `ToolCallApprovedEvent` | User approved |
| `onToolCallDenied` | `ToolCallDeniedEvent` | User denied |
| `onToolCallResult` | `ToolCallResultEvent` | Tool completed |
| `onToolCallAutoApproved` | `ToolCallAutoApprovedEvent` | Auto-approved (allow list / always-allow source) |

### Aggregate "updated" callbacks (8)

These fire alongside the granular events and carry a `kind`
discriminator so a single subscriber can handle every change in a
domain.

| Callback | Event | `kind` values |
| --- | --- | --- |
| `onThreadsUpdated` | `ThreadsUpdatedEvent` | `"created"`, `"switched"`, `"renamed"`, `"cleared"`, `"deleted"` |
| `onProfilesUpdated` | `ProfilesUpdatedEvent` | `"created"`, `"updated"`, `"deleted"` |
| `onCurrentChatProfileUpdated` | `CurrentChatProfileUpdatedEvent` | `scope: "session" \| "persisted"` |
| `onModelAssignmentUpdated` | `ModelAssignmentUpdatedEvent` | `task` ∈ `{default, chat, code, summarization, translation, textAnalysis, imageGeneration, ocr, vision}` |
| `onServersUpdated` | `ServersUpdatedEvent` | `"config-saved"`, `"server-deleted"`, `"tool-toggled"`, `"tool-auto-approve-changed"` |
| `onWebSearchUpdated` | `WebSearchUpdatedEvent` | — (carries `enabled`, `provider`, `isCloudProvider`) |
| `onExtendedThinkingUpdated` | `ExtendedThinkingUpdatedEvent` | — (carries `enabled`) |
| `onSystemPromptAppendixUpdated` | `SystemPromptAppendixUpdatedEvent` | — (carries `appendix`) |

### Errors (1)

| Callback | Event | Trigger |
| --- | --- | --- |
| `onError` | `ChatErrorEvent` | `type: "provider" \| "tool" \| "network" \| "storage"` |

The full event type definitions live in
[`src/ui/providers/EventsProvider/types.ts`](../../../src/ui/providers/EventsProvider/types.ts).

## `EventsProvider` and `useCallbacksManager`

In headless mounting, wrap the tree with `EventsProvider` and pass
your callbacks. Internally the widget does the same:

```tsx
const callbacksManager = useMemo(() => new CallbacksManager(), []);

<EventsProvider callbacksManager={callbacksManager} callbacks={callbacks}>
  <App />
</EventsProvider>;
```

From a child component, read the manager via
`useCallbacksManager()` if you need to register callbacks
imperatively (e.g. inside a custom page).

## `ChatEventBus` (internal)

Lightweight pub/sub used by `Servers` and a few stores. Handlers
receive no payload — the event name carries the meaning. Currently
the only public usage is `"tools-changed"`, emitted by
`CustomServers`, `WebSearch`, and `ImageGeneration` when their
tool list mutates.

```ts
const bus = new ChatEventBus();
bus.on("tools-changed", () => console.log("tools updated"));
bus.emit("tools-changed");
bus.off("tools-changed", handler);
```

You normally do not subscribe to it from consumer code — the
public surface is `ChatCallbacks`.
