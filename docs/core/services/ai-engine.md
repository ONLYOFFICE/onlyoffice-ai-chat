# `AIEngine`

> Source: [`src/core/services/ai/`](../../../src/core/services/ai)

`AIEngine` is the single entry point for *running* an AI call. It
binds the [`actions/`](../../../src/core/actions) layer (which knows
how to talk to a provider) to a
[`StorageAdapter`](../../../src/core/storage/adapter.ts) (which
knows how to persist threads, messages and profile assignments), so
that callers don't have to wire those pieces together themselves.

It exposes five call shapes:

| Method                | Streams? | Touches storage? | Profile slot           | Action     |
| --------------------- | -------- | ---------------- | ---------------------- | ---------- |
| [`sendWithStream`](#sendwithstream) | ✅ stream | ✅ thread + messages | `Chat` → `Default`     | `chat`     |
| [`regenerateStream`](#regeneratestream) | ✅ stream | ✅ delete + messages | `Chat` → `Default`     | `chat`     |
| [`approveToolCall`](#approvetoolcall) | ✅ stream | ✅ messages | `Chat` → `Default` | resumes `chat` |
| [`denyToolCall`](#denytoolcall) | ✅ stream | ✅ messages | `Chat` → `Default` | resumes `chat` |
| [`send`](#send)               | one-shot | ❌ no writes        | `<actionType>` → `Default` | any registered action |
| [`sendCustom`](#sendcustom)         | both     | ❌ no writes        | `Default`              | `custom`   |

---

## Construction

```ts
import { AIEngine } from "@/core/services";

const engine = new AIEngine({ storage });
```

```ts
type AIEngineDeps = {
  storage: StorageAdapter;
  assignments?: AssignmentsEngine;
  threads?: ThreadsEngine;

  /**
   * Optional pluggable tool source. Tools it returns are auto-executed
   * in-engine when the model picks one — no UI approval round-trip.
   * See {@link ToolsAdapter}.
   */
  toolsAdapter?: ToolsAdapter;

  /**
   * Server-type keys whose adapter tools must be approved in the UI
   * before the engine executes them server-side — vs. the silent
   * auto-exec of every other adapter tool. Use for `SystemToolsSource`:
   * `() => systemToolsSource.getServerTypes()`.
   */
  systemServerTypes?: string[] | (() => string[]);

  /**
   * The tool permission mode assumed while the user has persisted none.
   * Pass the same value as `PreferenceDefaults.toolPermissionMode` when
   * the host overrides that default. Defaults to `"auto"`.
   */
  defaultToolPermissionMode?: ToolPermissionMode;

  /**
   * Names the entry a round is billed to — a `SourceMeta`
   * (`{ id, type?, title? }`). Called once per entry point with the
   * round's context scope and thread; the answer reaches every provider
   * request of the round (chat, tool-call resume rounds, title
   * generation, the built-in image tool) and the built-in web-search
   * requests as the `metadata` object (`source_id` / `source_type` /
   * `source_title`) on the ONLYOFFICE provider. When wired, a
   * caller-supplied `actionArgs.source` is ignored.
   */
  resolveSource?: SourceResolver; // (scope: { entityId?, threadId? }) => SourceMeta | undefined
};
```

Without `resolveSource`, the engine forwards whatever `actionArgs.source`
the caller sent. A server-side host should wire the hook and resolve the
entry itself, so a client can only *name* an entry, never describe one it
cannot see.

The engine is stateless across calls — share one instance per
`AppContext`. All persistence flows through `deps.storage`; swap
that out and the engine works identically against any backend.
Sub-engines (`assignments`, `threads`) default to fresh instances
built from `storage` when omitted.

---

## `sendWithStream`

The full **streaming chat** lifecycle: resolve the `Chat` profile,
open or create the thread, persist the user message, build the
tool list (adapter + built-in web-search / image-generation +
caller-supplied), dispatch the `chat` action, and stream every
event to the caller. The terminal event additionally writes the
assistant's response to storage.

### Signature

```ts
async *sendWithStream(input: SendStreamInput): AsyncGenerator<ChatEvent>;
```

```ts
type SendStreamInput = {
  /** Target thread. Omit to create a new thread with an auto-generated title. */
  threadId?: string;
  userMessage: ThreadMessageLike;
  /** Forwarded to the underlying action. `profile` and `messages` are owned by the engine. */
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
  /**
   * Opaque scope token (see `WidgetConfig.entityId`). Forwarded to
   * `AssignmentsEngine.resolveForAction` (so storage can return an
   * entity-specific Chat profile) and persisted on a freshly created
   * thread. The engine never inspects the value.
   */
  entityId?: string;
};

type ChatEvent =
  | { type: "message-start"; message: ThreadMessageLike; messageId: string }
  | { type: "message-delta"; message: ThreadMessageLike; messageId: string }
  | { type: "message-end";   message: ThreadMessageLike; messageId: string }
  | { type: "message-incomplete"; message: ThreadMessageLike }
  | {
      type: "tool-call-pending";
      message: ThreadMessageLike;
      idx: number;
      messageId: string;
      threadId: string;
      /** True when `toolName` is in `storage.toolPrefs.allowAlways` — caller skips dialog. */
      autoAllow: boolean;
    }
  | {
      type: "thread-title";
      threadId: string;
      title: string;
      profileId?: string;
    };
```

The stream is **transport-agnostic and middleware-free** — every
observable side effect is encoded as a `ChatEvent`. User
middleware (`beforeSend`, `onStreamChunk`, `beforeToolCall`,
`afterToolResult`, `beforeDisplay`, `onError`) runs on the
consumer side, around this generator.

### What it does, step by step

1. **Resolve profile.** Look up
   `storage.assignments.readByType("Chat")`; if nothing is
   assigned, fall back to `Default`. Throw if neither slot is set
   or the resolved ID is missing from `storage.profiles`.
2. **Bootstrap thread.**
   - With `threadId`: read `storage.messages.readByThread(threadId)`
     for prior history; persist the new user message.
   - Without: create a placeholder thread `"New chat"` with a
     fresh id, persist the user message, **yield**
     `thread-title` immediately so the UI can show the placeholder,
     then run [`generateTitle`](../../../src/core/actions/title/index.ts)
     in parallel with the chat stream.
3. **Build tool context.** [`buildToolContext`](../../../src/core/services/ai/tools.ts)
   resolves four sources in parallel:
   - `toolsAdapter?.getTools()` — pluggable adapter (grouped by `serverType`),
   - [`getWebSearchTools(storage)`](../../../src/core/services/web-search/source.ts) — built-in,
   - [`getImageGenerationTools(storage)`](../../../src/core/services/ai/sources/image-generation.ts) — built-in,
   - `storage.toolPrefs.readDisabled()` — user-disabled filter.

   Output: merged tool list (caller-supplied wins on `name`
   collision) and lookup sets used to classify tool calls later.
4. **Dispatch `chat` action.** Build `ActionArgs` from
   `input.actionArgs` plus the resolved `profile`, full message
   history, and merged `tools`.
5. **Drive the provider stream** via [`processStream`](../../../src/core/services/ai/stream.ts):
   - first delta → `storage.messages.create(...)` + emit `message-start`,
   - subsequent deltas → `storage.messages.update(...)` + emit `message-delta`,
   - terminal `isEnd` → emit `message-end` (or `message-incomplete`),
   - unresolved tool call in the terminal message → emit
     `tool-call-pending` with `autoAllow` derived from the tool
     permission mode (`storage.preferences.readToolPermissionMode()`,
     default `"auto"`), `storage.toolPrefs.readAllowAlways()` and the
     tool's `requireApproval` and MCP `annotations` — see `resolveAutoAllow` in
     [`auto-allow.ts`](../../../src/core/services/tools/auto-allow.ts).
6. **Wrap in [`runChatStream`](../../../src/core/services/ai/engine.ts).**
   For every `tool-call-pending`:
   - If the tool came from `toolsAdapter` / built-in source **and is
     not a system tool** → execute server-side via
     [`executeAdapterTool`](../../../src/core/services/ai/tools.ts),
     persist the result, resume the chat with the augmented
     history, and recursively re-enter `runChatStream` so further
     adapter tool calls keep auto-executing.
   - If the tool is a **system tool** (its server type is in
     `deps.systemServerTypes`) and not always-allowed → pass the
     event through flagged `serverExecuted: true`. The consumer shows
     the approval dialog and resumes via `approveToolCall` **with no
     result** — the engine executes it server-side on approve. (When
     always-allowed, it auto-executes like any adapter tool.)
   - Otherwise (user tools from `actionArgs.tools`) — pass the event
     through to the consumer; control returns to await an
     `approveToolCall` / `denyToolCall` follow-up call.
7. **Final title yield** (new threads only): once the inner
   stream exits, await `titlePromise`, persist via
   `storage.threads.update`, and emit a second `thread-title` with
   the real title.

### Errors

`sendWithStream` throws synchronously if profile resolution fails —
no thread is created, no message is persisted. Provider-side
errors surface as `message-incomplete` events; the message is not
written to storage.

#### Error event payload

When `status.reason === "error"`, `status.error` is always a
`ChatErrorPayload` — never a raw `Error`. `Error` instances are
non-serializable (`message` / `stack` / `name` are non-enumerable);
the engine runs every error through `toChatError(err)` before
yielding the event so hosts can pipe the NDJSON stream through
stock `JSON.stringify` and the UI can render `error.message`
without falling back to `[object Object]`.

```ts
type ChatErrorPayload = {
  code: string;     // stable machine-readable kind
  message: string;  // end-user-safe text
  cause?: ChatErrorPayload;
};
```

Canonical `code` values:

| Code | Origin |
|---|---|
| `auth` | HTTP 401/403, `invalid_api_key`, `authentication_error` |
| `model_not_found` | HTTP 404 referring to a model, or `not_found_error` with "model" in the message |
| `rate_limit` | HTTP 429, `rate_limit_error` |
| `timeout` | HTTP 408, or any error whose message mentions "timeout" |
| `network` | `TypeError: fetch failed` / network-class failures |
| `bad_request` | HTTP 400 |
| `server` | HTTP ≥ 500 |
| `not_found` | HTTP 404 (non-model) |
| `aborted` | `AbortError` (caller-supplied signal) |
| `unknown` | everything else |

Stack traces are intentionally stripped from the payload —
keep them in server logs. `toChatError` is exported from
`@onlyoffice/ai-chat` for custom providers / middleware that want
to surface the same shape.

### Example

```ts
const engine = new AIEngine({ storage, toolsAdapter });

for await (const event of engine.sendWithStream({
  userMessage: { role: "user", content: [{ type: "text", text: "Hi!" }] },
  actionArgs: { isReasoning: true, signal: ac.signal },
})) {
  switch (event.type) {
    case "message-delta":
      renderDelta(event.message);
      break;
    case "tool-call-pending":
      // event.autoAllow tells you whether to skip the approval dialog.
      // Execute the tool yourself, then call engine.approveToolCall(...).
      break;
    case "thread-title":
      console.log("title:", event.title);
      break;
  }
}
```

---

## Tool-call lifecycle

Tool calls fall into two paths depending on where the tool came
from:

**Adapter / built-in tools** (web-search, image-generation, anything
contributed by `toolsAdapter`):

```
sendWithStream
  → tool-call-pending (intercepted by runChatStream)
  → executeAdapterTool (callTool + persist result)
  → resumeChat → new processStream
  → runChatStream recurses
```

The consumer never sees `tool-call-pending` for these — execution
is fully server-side.

**User tools** (anything in `actionArgs.tools` not also in the
adapter / built-in lists):

```
sendWithStream → tool-call-pending → consumer
                                       │
                                       ├─ executes the tool
                                       │
                                       ├─ approveToolCall(result)  → resumeChat → stream
                                       │
                                       └─ denyToolCall()           → resumeChat → stream
                                            (result = "User deny tool call")
```

The consumer is responsible for the actual dispatch and for any
`beforeToolCall` / `afterToolResult` middleware. The engine just
persists the supplied result and resumes.

---

## `regenerateStream`

```ts
async *regenerateStream(input: RegenerateStreamInput): AsyncGenerator<ChatEvent>;
```

```ts
type RegenerateStreamInput = {
  threadId: string;                          // must already exist
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
  entityId?: string;
};
```

Re-rolls the latest assistant reply in an existing thread. Reads
the persisted history via `storage.messages.readByThread`, finds
the last `user` message, deletes every trailing message
(`storage.messages.delete` per id — covers tool-call hops + the
old assistant reply), and streams a fresh reply through the same
`processStream` + `runChatStream` pipeline as `sendWithStream`.

Skips the title-generation / placeholder-thread branch of
`sendWithStream` — `regenerateStream` only operates on a thread
that already exists. Returns silently (no events) when the thread
has no `user` message.

The user message itself is **not** deleted or re-created — its
storage row, attachments, and id are left intact, so the regenerated
reply lands against the same prompt with no extra writes.

### Example

```ts
for await (const event of engine.regenerateStream({
  threadId: "t-42",
  actionArgs: { isReasoning: true },
})) {
  if (event.type === "message-end") {
    console.log("fresh reply:", event.message);
  }
}
```

The UI ships this wired into `ActionBarPrimitive.Reload` under
each assistant message, with a programmatic
[`useMessages().regenerate(parentIndex)`](../../ui/hooks.md#usemessagesisready)
on top for hosts that need to trigger it from elsewhere.

---

## `approveToolCall`

```ts
async *approveToolCall(input: ApproveToolCallInput): AsyncGenerator<ChatEvent>;
```

```ts
type ApproveToolCallInput = ToolCallData & {
  result: unknown;
  /** Persist `toolName` to `storage.toolPrefs.allowAlways`. */
  allowAlways?: boolean;
};
// `ToolCallData` carries the original `actionArgs` and `entityId` —
// when `allowAlways: true` is combined with a non-empty `entityId`,
// the auto-approve token is written to the entity-scoped allow list,
// not the global one.
```

Persists `result` onto the assistant message that issued the call
and resumes the chat. Wrapped in `runChatStream` so any further
adapter tool calls in the resumed round still auto-execute.

When `allowAlways: true`, the engine appends the prefixed tool
name to `storage.toolPrefs.allowAlways`; subsequent rounds surface
`tool-call-pending` with `autoAllow: true` and the consumer skips
the dialog — in every permission mode, `"ask"` included.

## `denyToolCall`

```ts
async *denyToolCall(input: DenyToolCallInput): AsyncGenerator<ChatEvent>;
```

```ts
type DenyToolCallInput = ToolCallData;
```

Same as `approveToolCall` but the persisted result is the literal
string `"User deny tool call"` — no consumer-supplied value, no
allow-list write.

---

## `send`

Run **any registered action** against a single user message, no
thread, no history, no persistence. Useful for one-off calls like
"summarize this selection", "translate this paragraph", "describe
this image".

### Signature

```ts
async send(input: SendInput): Promise<ThreadMessageLike>;
```

```ts
type SendInput = {
  /** Determines both the assignment slot and the action function invoked. */
  actionType: ActionType;
  userMessage: ThreadMessageLike;
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
  /**
   * Opaque scope token forwarded to
   * `AssignmentsEngine.resolveForAction`. Storage decides whether to
   * apply it (typically only for `ActionType.Chat`).
   */
  entityId?: string;
};
```

### Action support matrix

`send` dispatches to the right action by `actionType`:

| `ActionType`      | Action function   | Module                                      |
| ----------------- | ----------------- | ------------------------------------------- |
| `Chat`            | `chat` (drained)  | [`chat/`](../../../src/core/actions/chat) — streams to terminal, returns the final message |
| `Summarization`   | `summarize`       | [`summarization/`](../../../src/core/actions/summarization) |
| `Translation`     | `translate`       | [`translation/`](../../../src/core/actions/translation)     |
| `TextAnalyze`     | `analyzeText`     | [`text-analyze/`](../../../src/core/actions/text-analyze)   |
| `ImageGeneration` | `generateImage`   | [`image-generation/`](../../../src/core/actions/image-generation) |
| `OCR`             | `recognizeText`   | [`ocr/`](../../../src/core/actions/ocr)     |
| `Vision`          | `describeImage`   | [`vision/`](../../../src/core/actions/vision) |

`Default` is **not** a destination action — it's a fallback profile
slot. Calling `send({ actionType: "Default", … })` throws.

`Chat` is special: there's no sync `chat` function, so `send`
drains the streaming action through
[`drainToFinal`](../../../src/core/services/ai/actions.ts) and
returns the terminal `responseMessage`. If the stream ends without
an `isEnd` event, `drainToFinal` throws
`"Streaming action produced no terminal result"`.

### What it does

1. **Resolve profile.** Look up
   `storage.assignments.readByType(actionType)` with `Default`
   fallback. Throws on missing assignment or missing profile.
2. **Build args.** `messages: [userMessage]` — single-turn, no
   thread history.
3. **Dispatch.**
   - `Chat` → `drainToFinal(chat(args))`.
   - any other registered type → `runSync(actionType, args)`.
4. **Return the message.** No write to `storage.messages`,
   `storage.threads`, or anywhere else.

### Errors

- `"No profile assigned to ActionType.<X> and no usable default set"` —
  neither the specific slot nor `Default` is set.
- `"Assigned profile not found: <id>"` — the assignment row
  references a profile that has been deleted out of band.
- `"No action registered for ActionType.<X>"` — `actionType` is
  outside the table above (e.g. `Default`).
- `"Streaming action produced no terminal result"` — only for
  `Chat`, when the stream closes without an `isEnd` event.

### Example

```ts
const engine = new AIEngine({ storage });

// Summarize, no thread state changes
const summary = await engine.send({
  actionType: "Summarization",
  userMessage: { role: "user", content: [{ type: "text", text: longArticle }] },
});

// One-shot chat (uses the streaming action under the hood, drained for you)
const reply = await engine.send({
  actionType: "Chat",
  userMessage: { role: "user", content: [{ type: "text", text: "Hello" }] },
  actionArgs: { signal: ac.signal },
});
```

---

## `sendCustom`

A **free-form, one-turn** call against the `Default` profile with a
caller-supplied system prompt. Mode is chosen at call time via
`isStream`. Unlike `send`, the prompt isn't baked-in; unlike
`sendWithStream`, there's no thread.

### Signature

```ts
sendCustom(
  input: SendCustomInput
): AsyncGenerator<SendMessageResult> | Promise<ThreadMessageLike>;
```

```ts
type SendCustomInput = {
  isStream: boolean;
  systemPrompt: string;
  userMessage: ThreadMessageLike;
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
};
```

The return type is a runtime union — TypeScript can't infer it
from a value-level boolean. Either narrow with a literal-type
helper, or branch on `isStream` and assert the branch you took:

```ts
const result = engine.sendCustom({
  isStream: false,
  systemPrompt: "Be concise.",
  userMessage: { role: "user", content: [{ type: "text", text: "..." }] },
}) as Promise<ThreadMessageLike>;
```

### What it does

1. **Resolve `Default` profile.** Skips per-action assignment
   slots and goes straight to `storage.assignments.readByType("Default")`.
2. **Build args.** `messages: [userMessage]`, plus `systemPrompt`.
3. **Dispatch the `custom` action.**
   - `isStream: true` → returns the action's `AsyncGenerator<SendMessageResult>`.
   - `isStream: false` → `customSync` returns a single
     `{ role: "assistant", content: [{ type: "text", text }] }`.

No persistence in either mode.

### When to use it

- Quick, prompt-driven utility calls that don't fit one of the
  named `ActionType`s (e.g. "rewrite in formal tone", "extract
  questions only").
- Power-user features that take an end-user prompt and run it
  against the same profile the rest of the app is using.

For task-specific, app-owned prompts (summarize, translate, …),
prefer `send` — the prompt lives in the action module and stays
consistent across callers.

---

## System-prompt overrides on baked-in actions

Every action with a baked-in system prompt accepts an optional
override through `actionArgs.prompt`:

```ts
type SystemPromptOverride =
  | { mode: "replace"; text: string }
  | { mode: "append"; text: string };
```

| Mode      | Effect                                                     |
| --------- | ---------------------------------------------------------- |
| omitted   | Use the action's baked-in prompt verbatim                  |
| `replace` | Drop the default, use `text` instead                       |
| `append`  | Keep the default, append `text` after a blank line         |

The override is wired into `chat`, `summarize`, `translate`,
`analyzeText`, `generateImage`, `recognizeText`, `describeImage`
and `generateTitle`. The `custom` action ignores it — it already
takes a raw `systemPrompt: string`.

```ts
// Replace the default summary prompt
await engine.send({
  actionType: "Summarization",
  userMessage,
  actionArgs: { prompt: { mode: "replace", text: "Summarise in Russian." } },
});

// Append a constraint to the default chat prompt
for await (const ev of engine.sendWithStream({
  userMessage,
  actionArgs: { prompt: { mode: "append", text: "Always respond in formal Polish." } },
})) {
  /* … */
}
```

The exact resolution logic lives in
[`actions/system-prompt.ts`](../../../src/core/actions/system-prompt.ts):

```ts
function resolveSystemPrompt(defaultPrompt, override) {
  if (!override) return defaultPrompt;
  if (override.mode === "replace") return override.text;
  return `${defaultPrompt}\n\n${override.text}`;
}
```

---

## Internal helpers

The engine's three public methods are intentionally short — most of
the work lives in collaborators in the same folder. You shouldn't
need to call them directly, but knowing where the logic is helps
when reading or extending the engine.

| File                                                                           | Exports                                | Role |
| ------------------------------------------------------------------------------ | -------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/ai/engine.ts)                          | `AIEngine`                             | Public class — `sendWithStream` / `approveToolCall` / `denyToolCall` / `send` / `sendCustom`, plus the private `runChatStream` interceptor for adapter tool calls. |
| [`types.ts`](../../../src/core/services/ai/types.ts)                            | `AIEngineDeps`, `SendStreamInput`, `SendInput`, `SendCustomInput`, `SendResult`, `ApproveToolCallInput`, `DenyToolCallInput`, `ToolCallData`, `ChatEvent` | Type definitions for every public input / output |
| [`stream.ts`](../../../src/core/services/ai/stream.ts)                          | `processStream`, `persistTerminal`     | Drive a `SendMessageResult` stream end-to-end into `ChatEvent`s. Persist deltas + terminal message; emit `tool-call-pending` with `autoAllow` set from the permission mode, `storage.toolPrefs` and the tool's `requireApproval`. |
| [`tool-call.ts`](../../../src/core/services/ai/tool-call.ts)                    | `ToolCallPart`, `readToolCall`, `readToolCallArgs`, `replaceContentPart`, `patchToolCallArgs`, `patchToolCallResult`, `resumeChat` | Tool-call message-part helpers + `resumeChat` (persists result, resumes a fresh `processStream` merged into the same assistant bubble). |
| [`tools.ts`](../../../src/core/services/ai/tools.ts)                            | `ToolContext`, `buildToolContext`, `executeAdapterTool`, `resolveToolSource`, `mergeToolsByName` | Tool-list aggregation and adapter-tool dispatch. Used by `sendWithStream` / `approveToolCall` / `denyToolCall`. |
| [`sources/image-generation.ts`](../../../src/core/services/ai/sources/image-generation.ts) | `getImageGenerationTools`, `callImageGenerationTool`, `IMAGE_GENERATION_TYPE` | Built-in image-generation source — `getTools` gated by an explicit `ActionType.ImageGeneration` assignment; `callTool` resolves the profile + provider at call time. |
| [`actions.ts`](../../../src/core/services/ai/actions.ts)                        | `runSync`, `drainToFinal`, `SYNC_ACTIONS` | Sync-action registry keyed by `ActionType`; helper that drains a stream to its terminal message. |
| [`custom.ts`](../../../src/core/services/ai/custom.ts)                          | `runCustomStream`, `runCustomOnce`     | Build `CustomArgs` against the `Default` profile (resolved via `AssignmentsEngine`) and dispatch `custom` / `customSync`. |
| [`index.ts`](../../../src/core/services/ai/index.ts)                            | barrel                                 | Re-exports `AIEngine` and the public types |

Built-in web-search lives in
[`core/services/web-search/source.ts`](../../../src/core/services/web-search/source.ts) —
in the same folder as `WebSearchEngine` (config persistence) so
both pieces of the feature stay together.

Profile resolution and thread bootstrap are delegated to
[`AssignmentsEngine`](./assignments-engine.md) and
[`ThreadsEngine`](./threads-engine.md). `AIEngine` constructs them
from `storage` by default; pass your own through `AIEngineDeps`
to share instances.

---

## Persistence semantics — at a glance

| Trigger                                                  | Storage write                                                |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `sendWithStream`, new thread                             | `threads.create("New chat", profileId)`, `messages.create` (user) |
| `sendWithStream`, existing thread                        | `threads.appendUserMessage` (touches thread + persists user) |
| `sendWithStream`, first delta                            | `messages.create` (assistant placeholder)                    |
| `sendWithStream`, subsequent deltas / terminal           | `messages.update` (assistant)                                |
| `sendWithStream`, new thread, after stream ends          | `threads.update(threadId, generatedTitle)`                   |
| `approveToolCall`, `allowAlways: true`                   | `toolPrefs.upsertAllowAlways([...prev, toolName])`           |
| `approveToolCall` / `denyToolCall`, resume               | `messages.update` (writes `result` onto the tool-call part)  |
| Adapter / built-in tool intercepted by `runChatStream`   | Same as above (executes server-side, then resumes)           |
| Provider-side error → `message-incomplete`               | *no write*                                                   |
| `send`                                                   | *no write*                                                   |
| `sendCustom`                                             | *no write*                                                   |

---

## Designing on top of `AIEngine`

- **Thread-aware UI flows** (chat composer, retry, edit-and-resend)
  → `sendWithStream`. Pass a `signal` from an `AbortController`
  if you want stop-streaming UX.
- **Quick actions** that operate on a selection or document and
  return a single answer → `send` with the matching `ActionType`.
- **Power-user prompt boxes** that let the end-user supply a
  system prompt → `sendCustom`.
- **App-wide prompt customizations** (tone, language, domain
  constraints) → bake-in override via `actionArgs.prompt` of mode
  `append` so the action's default logic stays in effect.

When you find yourself writing a fourth code path, prefer adding a
new action (in `actions/`) and a new `ActionType` over expanding
the engine's API — the engine is meant to stay thin.
