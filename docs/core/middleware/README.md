# `core/middleware` — full reference

`ChatMiddleware` is the interception pipeline that runs around the
chat lifecycle. Six hooks let middleware block, modify, retry, or
fall back at well-defined points. Middleware lives in `core/`
because it is pure logic — no React, no browser-only APIs.

For passive observation (analytics, logging) use
[`ChatCallbacks`](../../ui/providers/events.md) instead — middleware is for
intercepting and transforming.

```ts
import {
  MiddlewareRunner,
} from "@onlyoffice/ai-chat/middleware";
import type {
  ChatMiddleware,
  BeforeSendContext,
  BeforeSendResult,
  StreamChunkContext,
  StreamChunkResult,
  BeforeToolCallContext,
  BeforeToolCallResult,
  AfterToolResultContext,
  AfterToolResultResult,
  BeforeDisplayContext,
  BeforeDisplayResult,
  ErrorContext,
  ErrorResult,
} from "@onlyoffice/ai-chat/middleware";
```

The full type definitions live in
[`src/core/middleware/types.ts`](../../../src/core/middleware/types.ts).

## The six hooks

### `beforeSend`

Fires once per outgoing user message before it reaches the
provider.

| Field | Type |
| --- | --- |
| `text` | `string` |
| `files` | `TAttachmentRef[]` |
| `images` | `TAttachmentRef[]` |
| `threadId` | `string` |
| `profile` | `Profile \| null` |
| `existingMessages` | `ThreadMessageLike[]` |
| `resolveAttachment` | `(id) => Promise<{ title, kind, content?, base64?, path?, type? } \| null>` |

`files`/`images` carry **lightweight refs** (`{ id, title, kind, path?, type? }`) — the heavy payload (file text, image base64) lives in `storage.attachments` and is hydrated by core just before the provider sees the message. If a middleware needs the raw content (e.g. for content scanning), call `resolveAttachment(id)` to fetch it on demand.

Result: `{ action: "continue", text?, files?, images? }` or
`{ action: "block", reason? }`.

### `onStreamChunk`

Fires for each chunk during streaming.

| Field | Type |
| --- | --- |
| `chunk` | `ThreadMessageLike` |
| `threadId` | `string` |
| `messageUID` | `string` |
| `isFirst` | `boolean` |

Result: `{ action: "continue", chunk? }` or `{ action: "skip" }`.

### `beforeToolCall`

Fires before each tool execution.

| Field | Type |
| --- | --- |
| `toolName` | `string` |
| `toolArgs` | `Record<string, unknown>` |
| `toolSource` | `string` (host group id, `"web-search"`, `"mcp-{name}"`, …) |
| `threadId` | `string` |
| `messageUID` | `string` |

Result: `{ action: "continue", args? }`, `{ action: "deny", reason? }`,
or `{ action: "approve" }` (skip the user-approval dialog).

### `afterToolResult`

Fires once per completed tool call before the result is sent back
to the model.

| Field | Type |
| --- | --- |
| `toolName` | `string` |
| `toolArgs` | `Record<string, unknown>` |
| `result` | `unknown` |
| `threadId` | `string` |

Result: `{ action: "continue", result? }` or `{ action: "skip" }`.

### `beforeDisplay`

Fires once per message before it is rendered or persisted.

| Field | Type |
| --- | --- |
| `message` | `ThreadMessageLike` |
| `threadId` | `string` |
| `isStreaming` | `boolean` |

Result: `{ action: "continue", message? }` or `{ action: "skip" }`.

### `onError`

Fires on any chat-related error.

| Field | Type |
| --- | --- |
| `error` | `unknown` |
| `type` | `"provider" \| "tool" \| "network" \| "storage"` |
| `threadId?` | `string` |
| `messageUID?` | `string` |
| `profile?` | `Profile` |

Result: `{ action: "default" }`, `{ action: "retry", delay? }`,
`{ action: "fallback", profileId }`, or `{ action: "suppress" }`.

## Short-circuit table

| Hook | Short-circuit actions |
| --- | --- |
| `beforeSend` | `"block"` |
| `onStreamChunk` | `"skip"` |
| `beforeToolCall` | `"deny"`, `"approve"` |
| `afterToolResult` | `"skip"` |
| `beforeDisplay` | `"skip"` |
| `onError` | `"retry"`, `"fallback"`, `"suppress"` |

A short-circuit action stops the rest of the chain immediately.
Otherwise each middleware passes (possibly modified) context to
the next.

## `MiddlewareRunner`

The runner executes middlewares sequentially, threading context
between them. It is the single coordinator used by both
`AIChatWidget` and headless mounts.

```ts
const runner = new MiddlewareRunner([m1, m2, m3]);

const result = await runner.runBeforeSend(ctx);
if (result.action === "block") console.warn("Blocked:", result.reason);
```

`runner.isEmpty` lets callers skip the async call entirely when no
middlewares are registered.

## Wiring

Pass middlewares via the `middleware` prop on `AIChatWidget`:

```tsx
<AIChatWidget middleware={[contentFilter, requestLogger, retry]} />;
```

In headless mode, build the runner yourself and pass it through
`AppContext` (see [`../../headless-usage.md`](../../headless-usage.md)).

## Examples

### Content filter

```ts
import type { ChatMiddleware } from "@onlyoffice/ai-chat/middleware";

const contentFilter: ChatMiddleware = {
  beforeSend: async (ctx) => {
    const forbidden = ["spam", "phishing"];
    if (forbidden.some((w) => ctx.text.toLowerCase().includes(w))) {
      return { action: "block", reason: "Forbidden content" };
    }
    return { action: "continue" };
  },
};
```

### Request logger

```ts
const requestLogger: ChatMiddleware = {
  beforeSend: async (ctx) => {
    console.log(`[send] ${ctx.threadId}: "${ctx.text.slice(0, 50)}"`);
    return { action: "continue" };
  },
  beforeToolCall: async (ctx) => {
    console.log(`[tool] ${ctx.toolName}(${JSON.stringify(ctx.toolArgs)})`);
    return { action: "continue" };
  },
  onError: async (ctx) => {
    console.error(`[err type=${ctx.type}]`, ctx.error);
    return { action: "default" };
  },
};
```

### Retry on transient failures

```ts
const retry: ChatMiddleware = {
  onError: async (ctx) => {
    if (ctx.type === "provider" || ctx.type === "network") {
      return { action: "retry", delay: 2000 };
    }
    return { action: "default" };
  },
};
```
