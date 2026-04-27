# `AIEngine`

> Source: [`src/core/services/ai/`](../../../src/core/services/ai)

`AIEngine` is the single entry point for *running* an AI call. It
binds the [`actions/`](../../../src/core/actions) layer (which knows
how to talk to a provider) to a
[`StorageAdapter`](../../../src/core/storage/adapter.ts) (which
knows how to persist threads, messages and profile assignments), so
that callers don't have to wire those pieces together themselves.

It exposes three call shapes — pick whichever matches your use case:

| Method                | Streams? | Touches storage? | Profile slot           | Action     |
| --------------------- | -------- | ---------------- | ---------------------- | ---------- |
| [`sendWithStream`](#sendwithstream) | ✅ stream | ✅ thread + messages | `Chat` → `Default`     | `chat`     |
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
};
```

The engine is stateless across calls — share one instance per
`AppContext`. All persistence flows through `deps.storage`; swap
that out and the engine works identically against any backend.

---

## `sendWithStream`

The full **streaming chat** lifecycle: resolve the `Chat` profile,
open or create the thread, persist the user message, dispatch the
`chat` action, and stream every event to the caller. The terminal
event additionally writes the assistant's response to storage.

### Signature

```ts
async *sendWithStream(input: SendStreamInput): AsyncGenerator<SendResult>;
```

```ts
type SendStreamInput = {
  /** Target thread. Omit to create a new thread with an auto-generated title. */
  threadId?: string;
  userMessage: ThreadMessageLike;
  /** Forwarded to the underlying action. `profile` and `messages` are owned by the engine. */
  actionArgs?: Omit<ActionArgs, "profile" | "messages">;
};

type SendResult = {
  threadId: string;
  title: string;          // empty string for existing threads
  result: SendMessageResult; // raw event from the chat action
};
```

`SendMessageResult` is a union: each iteration yields either an
intermediate `ThreadMessageLike` (deltas, tool calls, reasoning
chunks) or the terminal `{ isEnd: true, responseMessage }` event
that closes the stream.

### What it does, step by step

1. **Resolve profile.** Look up
   `storage.assignments.readByType("Chat")`; if nothing is
   assigned, fall back to
   `storage.assignments.readByType("Default")`. Throw if neither
   slot is filled or the resolved ID is missing from
   `storage.profiles`.
2. **Open or create thread.**
   - With `threadId`: read `storage.messages.readByThread(threadId)`
     for prior history. The yielded `title` is `""`.
   - Without: generate a `threadId` (`crypto.randomUUID()`),
     call the [`generateTitle`](../../../src/core/actions/title/index.ts)
     action against the resolved profile, fall back to `"New chat"`
     if the model returns nothing, and `storage.threads.create`
     the thread.
3. **Persist user message + bump thread.** In parallel:
   - `storage.messages.create(threadId, randomUUID(), userMessage)`
   - `storage.threads.touch(threadId, Date.now(), { profileId })`
4. **Dispatch `chat` action.** Build `ActionArgs` from
   `input.actionArgs` plus the resolved `profile` and the full
   message history (`priorMessages` + `userMessage`).
5. **Stream and persist.** For every event the action yields, call
   [`persistTerminal`](../../../src/core/services/ai/stream.ts)
   (no-op for non-terminal events) and `yield { threadId, title,
   result }` to the caller. The terminal event saves the
   assistant's response to `storage.messages` **only if**
   `responseMessage.status?.reason !== "error"`. Cancelled
   responses still get saved — they carry the partial text the
   user has already seen.

### Errors

`sendWithStream` throws synchronously if profile resolution fails —
no thread is created, no message is persisted. After the first
yield, errors flow through the action's normal error path
(`responseMessage.status.reason === "error"`); those are *not*
written to storage.

### Example

```ts
const engine = new AIEngine({ storage });

// Continue an existing thread
for await (const { threadId, title, result } of engine.sendWithStream({
  threadId: "f3b2…",
  userMessage: { role: "user", content: [{ type: "text", text: "What's next?" }] },
  actionArgs: { isReasoning: true, signal: ac.signal },
})) {
  if ("isEnd" in result) {
    console.log("done:", result.responseMessage);
  } else {
    renderDelta(result);
  }
}

// Start a new thread; engine generates the title for you
const stream = engine.sendWithStream({
  userMessage: { role: "user", content: [{ type: "text", text: "Hi!" }] },
});
const first = await stream.next();
console.log(first.value?.title); // e.g. "Casual greeting"
```

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

- `"No profile assigned to ActionType.<X> and no default set"` —
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
| [`engine.ts`](../../../src/core/services/ai/engine.ts)                          | `AIEngine`                             | Public class — composes `AssignmentsEngine` + `ThreadsEngine` and dispatches actions |
| [`types.ts`](../../../src/core/services/ai/types.ts)                            | `AIEngineDeps`, `SendStreamInput`, `SendInput`, `SendCustomInput`, `SendResult` | Type definitions for every public input / output |
| [`stream.ts`](../../../src/core/services/ai/stream.ts)                          | `persistTerminal`                      | Save the assistant's response on the terminal `isEnd` event, except when `status.reason === "error"`. |
| [`actions.ts`](../../../src/core/services/ai/actions.ts)                        | `runSync`, `drainToFinal`, `SYNC_ACTIONS` | Sync-action registry keyed by `ActionType`; helper that drains a stream to its terminal message. |
| [`custom.ts`](../../../src/core/services/ai/custom.ts)                          | `runCustomStream`, `runCustomOnce`     | Build `CustomArgs` against the `Default` profile (resolved via `AssignmentsEngine`) and dispatch `custom` / `customSync`. |
| [`index.ts`](../../../src/core/services/ai/index.ts)                            | barrel                                 | Re-exports `AIEngine` and the public types |

Profile resolution and thread bootstrap, which used to live in
local `profile.ts` and `thread.ts` helpers, are now delegated to
[`AssignmentsEngine`](./assignments-engine.md) and
[`ThreadsEngine`](./threads-engine.md). `AIEngine` constructs them
from `storage` by default; pass your own through `AIEngineDeps`
to share instances.

---

## Persistence semantics — at a glance

| Trigger                                  | Storage write                                                |
| ---------------------------------------- | ------------------------------------------------------------ |
| `sendWithStream`, new thread             | `threads.create`, `messages.create` (user)                   |
| `sendWithStream`, existing thread        | `messages.create` (user), `threads.touch`                    |
| `sendWithStream`, terminal event, OK     | `messages.create` (assistant)                                |
| `sendWithStream`, terminal event, error  | *no write*                                                   |
| `sendWithStream`, terminal event, cancel | `messages.create` (assistant) — partial text is preserved    |
| `send`                                   | *no write*                                                   |
| `sendCustom`                             | *no write*                                                   |

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
