# Events & Middleware

The library provides two complementary systems for observing and intercepting the chat lifecycle: **callbacks** for passive observation and **middleware** for active interception and transformation.

## ChatCallbacks

`ChatCallbacks` is an interface with 19 optional handlers covering messages, tool calls, threads, profiles, and errors. Callbacks are purely observational -- they cannot modify or block behavior.

### Full Callback List

| Callback | Event Type | Trigger |
|----------|-----------|---------|
| `onMessageSent` | `MessageSentEvent` | User sends a message |
| `onStreamStart` | `StreamStartEvent` | Provider begins streaming |
| `onStreamDelta` | `StreamDeltaEvent` | Each incremental stream chunk |
| `onStreamEnd` | `StreamEndEvent` | Stream completes successfully |
| `onStreamError` | `StreamErrorEvent` | Stream encounters an error |
| `onStreamStop` | `StreamStopEvent` | User cancels an in-progress stream |
| `onToolCallPending` | `ToolCallPendingEvent` | Tool call awaits user approval |
| `onToolCallApproved` | `ToolCallApprovedEvent` | User approves a tool call |
| `onToolCallDenied` | `ToolCallDeniedEvent` | User denies a tool call |
| `onToolCallResult` | `ToolCallResultEvent` | Tool call returns a result |
| `onToolCallAutoApproved` | `ToolCallAutoApprovedEvent` | Tool call auto-approved |
| `onThreadCreated` | `ThreadCreatedEvent` | New thread created |
| `onThreadSwitched` | `ThreadSwitchedEvent` | Active thread changes |
| `onThreadDeleted` | `ThreadDeletedEvent` | Thread deleted |
| `onThreadRenamed` | `ThreadRenamedEvent` | Thread renamed (manual or auto) |
| `onThreadCleared` | `ThreadClearedEvent` | All messages in a thread cleared |
| `onProfileChanged` | `ProfileChangedEvent` | Active profile changes |
| `onProfileCreated` | `ProfileCreatedEvent` | New profile created |
| `onProfileDeleted` | `ProfileDeletedEvent` | Profile deleted |
| `onError` | `ChatErrorEvent` | Error occurs (provider/tool/network/storage) |

### Usage

Pass callbacks via the `callbacks` prop on `AIChatWidget`:

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { ChatCallbacks } from "@onlyoffice/ai-chat";

const callbacks: ChatCallbacks = {
  onMessageSent(data) {
    analytics.track("message_sent", { threadId: data.threadId });
  },
  onStreamEnd(data) {
    analytics.track("response_complete", { threadId: data.threadId });
  },
  onToolCallResult(data) {
    console.log(`Tool ${data.toolName} returned:`, data.result);
  },
  onError(data) {
    errorReporter.capture(data.error, { type: data.type, context: data.context });
  },
};

<AIChatWidget callbacks={callbacks} /* ...other props */ />;
```

Consumer callback errors are silently swallowed by the `CallbacksManager` so they never break the internal message flow.

## ChatMiddleware

Middleware provides 6 hooks for intercepting and transforming data at key points in the chat lifecycle. Each hook can modify context, short-circuit the pipeline, or pass through.

### The 6 Hooks

#### `beforeSend`

Intercepts outgoing user messages before they reach the provider.

| Context field | Type | Description |
|---------------|------|-------------|
| `text` | `string` | Raw message text |
| `files` | `TAttachmentFile[]` | File attachments |
| `images` | `TAttachmentImage[]` | Image attachments |
| `threadId` | `string` | Thread ID |
| `profile` | `Profile \| null` | Active AI profile |
| `existingMessages` | `ThreadMessageLike[]` | Prior messages in thread |

**Result:** `{ action: "continue", text?, files?, images? }` or `{ action: "block", reason? }`.

#### `onStreamChunk`

Intercepts each chunk during streaming.

| Context field | Type | Description |
|---------------|------|-------------|
| `chunk` | `ThreadMessageLike` | Current stream chunk |
| `threadId` | `string` | Thread ID |
| `messageUID` | `string` | Assistant message ID |
| `isFirst` | `boolean` | True for the first chunk only |

**Result:** `{ action: "continue", chunk? }` or `{ action: "skip" }`.

#### `beforeToolCall`

Intercepts tool calls before execution.

| Context field | Type | Description |
|---------------|------|-------------|
| `toolName` | `string` | Tool name |
| `toolArgs` | `Record<string, unknown>` | Tool arguments |
| `toolSource` | `string` | Source ID (group id, "web-search", "mcp-{name}") |
| `threadId` | `string` | Thread ID |
| `messageUID` | `string` | Assistant message ID |

**Result:** `{ action: "continue", args? }`, `{ action: "deny", reason? }`, or `{ action: "approve" }`.

#### `afterToolResult`

Intercepts tool results before they are sent back to the model.

| Context field | Type | Description |
|---------------|------|-------------|
| `toolName` | `string` | Tool name |
| `toolArgs` | `Record<string, unknown>` | Call arguments |
| `result` | `unknown` | Raw tool result |
| `threadId` | `string` | Thread ID |

**Result:** `{ action: "continue", result? }` or `{ action: "skip" }`.

#### `beforeDisplay`

Intercepts messages before they are rendered or persisted.

| Context field | Type | Description |
|---------------|------|-------------|
| `message` | `ThreadMessageLike` | The message |
| `threadId` | `string` | Thread ID |
| `isStreaming` | `boolean` | True if still streaming |

**Result:** `{ action: "continue", message? }` or `{ action: "skip" }`.

#### `onError`

Intercepts errors for custom recovery strategies.

| Context field | Type | Description |
|---------------|------|-------------|
| `error` | `unknown` | The error |
| `type` | `"provider" \| "tool" \| "network" \| "storage"` | Error category |
| `threadId` | `string?` | Thread ID (if available) |
| `messageUID` | `string?` | Message ID (if available) |
| `profile` | `Profile?` | Active profile (if available) |

**Result:** `{ action: "default" }`, `{ action: "retry", delay? }`, `{ action: "fallback", profileId }`, or `{ action: "suppress" }`.

### Short-Circuit Behavior

Blocking actions stop the middleware chain immediately:

| Hook | Short-circuit actions |
|------|----------------------|
| `beforeSend` | `"block"` |
| `onStreamChunk` | `"skip"` |
| `beforeToolCall` | `"deny"`, `"approve"` |
| `afterToolResult` | `"skip"` |
| `beforeDisplay` | `"skip"` |
| `onError` | `"retry"`, `"fallback"`, `"suppress"` |

### Usage

Pass middleware via the `middleware` prop on `AIChatWidget`:

```tsx
<AIChatWidget middleware={[contentFilter, logger, retryMiddleware]} />;
```

### MiddlewareRunner

The `MiddlewareRunner` class executes middlewares sequentially. Each hook method walks the middleware chain, threading the (possibly modified) context from one middleware to the next.

```ts
const runner = new MiddlewareRunner([mw1, mw2, mw3]);

const result = await runner.runBeforeSend(context);
if (result.action === "block") {
  console.warn("Blocked:", result.reason);
}
```

The `isEmpty` property lets callers skip the async call entirely when no middlewares are registered.

### Example: Content Filter

```ts
import type { ChatMiddleware } from "@onlyoffice/ai-chat";

const contentFilter: ChatMiddleware = {
  beforeSend: async (ctx) => {
    const forbidden = ["spam", "phishing"];
    if (forbidden.some((w) => ctx.text.toLowerCase().includes(w))) {
      return { action: "block", reason: "Message contains forbidden content" };
    }
    return { action: "continue" };
  },
};
```

### Example: Logging Middleware

```ts
const loggingMiddleware: ChatMiddleware = {
  beforeSend: async (ctx) => {
    console.log(`[send] thread=${ctx.threadId} text="${ctx.text.slice(0, 50)}"`);
    return { action: "continue" };
  },
  beforeToolCall: async (ctx) => {
    console.log(`[tool] ${ctx.toolName}(${JSON.stringify(ctx.toolArgs)})`);
    return { action: "continue" };
  },
  onError: async (ctx) => {
    console.error(`[error] type=${ctx.type}`, ctx.error);
    return { action: "default" };
  },
};
```

### Example: Retry Middleware

```ts
const retryMiddleware: ChatMiddleware = {
  onError: async (ctx) => {
    if (ctx.type === "provider" || ctx.type === "network") {
      return { action: "retry", delay: 2000 };
    }
    return { action: "default" };
  },
};
```

## ChatEventBus

The `ChatEventBus` is a lightweight internal pub/sub system used for fire-and-forget signaling between decoupled parts of the widget. Handlers receive no payload -- the event name alone carries the semantic meaning.

```ts
import { ChatEventBus } from "@onlyoffice/ai-chat";

const bus = new ChatEventBus();

// Subscribe
const handler = () => console.log("Tools changed!");
bus.on("tools-changed", handler);

// Emit
bus.emit("tools-changed");

// Unsubscribe
bus.off("tools-changed", handler);
```

The primary internal event is `"tools-changed"`, emitted by `CustomServers` and `WebSearch` when tool lists are updated. The UI subscribes to this event to refresh the tools display.
