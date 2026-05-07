# `ThreadsEngine`

> Source: [`src/core/services/threads/`](../../../src/core/services/threads)

`ThreadsEngine` is the lifecycle orchestrator for chat threads
and their messages. It wraps `storage.threads` + `storage.messages`
with the rules that plain CRUD can't express:

- **Auto-generated titles** for new threads via the
  [`generateTitle`](../../../src/core/actions/title) action, with
  a `"New chat"` fallback when the model returns nothing.
- **Coupled writes** — appending a user message also bumps the
  thread's `lastEditDate` so the sidebar resurfaces it.
- **Coordinated rename** — sets the title and bumps
  `lastEditDate` together so the rename is visible in the
  sidebar.
- **Title regeneration** on demand — re-runs `generateTitle`
  against the thread's first user message and persists the
  result.

The engine never touches assignments — callers (typically
[`AIEngine`](./ai-engine.md)) resolve a profile through
[`AssignmentsEngine`](./assignments-engine.md) and pass it in.

`core/` runs both on the server and the client; this engine has
no DOM / browser APIs anywhere.

---

## Construction

```ts
import { ThreadsEngine } from "@/core/services";

const engine = new ThreadsEngine({ storage });
```

```ts
type ThreadsEngineDeps = {
  storage: StorageAdapter;
};
```

The engine is stateless across calls. Share one instance per
`AppContext` and pass it into `AIEngine` to avoid duplicating
title-generation logic.

---

## Methods at a glance

| Method                                                | Returns                  | Persists?                                     | Touches profile? |
| ----------------------------------------------------- | ------------------------ | --------------------------------------------- | ---------------- |
| [`create`](#create)                                   | `string` (threadId)      | `threads`                                     | ❌               |
| [`openOrCreate`](#openorcreate)                       | `OpenOrCreateResult`     | `threads` (only when creating)                | ✅ for title gen |
| [`appendUserMessage`](#appendusermessage)             | `string` (messageId)     | `messages` + `threads.touch`                  | ❌               |
| [`rename`](#rename)                                   | `void`                   | `threads.update` + `threads.touch`            | ❌               |
| [`delete`](#delete)                                   | `void`                   | `threads.delete` (cascades to messages)        | ❌               |
| [`clearMessages`](#clearmessages)                     | `void`                   | `messages.deleteByThread` + `threads.touch`   | ❌               |
| [`regenerateTitle`](#regeneratetitle)                 | `string` (new title)     | `threads.update` + `threads.touch`            | ✅               |
| [`list`](#list-readmessages) / [`readMessages`](#list-readmessages) | `Thread[]` / `ThreadMessageLike[]` | ❌                                  | ❌               |

---

## `create`

Bare thread creation with a caller-supplied title. Generates the
`threadId` (`crypto.randomUUID()`) and persists the row. Use this
when you have a title up front (e.g. import flow, "duplicate
thread") and don't need the model to derive one.

### Signature

```ts
async create(input: {
  title: string;
  profileId?: string;
  /** Opaque scope token persisted on the new thread; see WidgetConfig.entityId. */
  entityId?: string;
}): Promise<string>;
```

### Example

```ts
const threadId = await engine.create({
  title: "Imported from Slack thread",
  profileId,
});
```

---

## `openOrCreate`

The smart entry point used by `AIEngine.sendWithStream`. Either
opens an existing thread (returning its prior history) or creates
a new one whose title is generated from the user's first message.

### Signature

```ts
async openOrCreate(input: OpenOrCreateInput): Promise<OpenOrCreateResult>;
```

```ts
type OpenOrCreateInput = {
  threadId?: string;
  profile: Profile;
  profileId: string;
  firstMessage: ThreadMessageLike;
};

type OpenOrCreateResult = {
  threadId: string;
  /** Empty string for existing threads — the engine doesn't re-fetch. */
  title: string;
  priorMessages: ThreadMessageLike[];
};
```

### What it does

- **With `threadId`**: read prior messages via
  `storage.messages.readByThread(threadId)`. The yielded `title`
  is `""`.
- **Without `threadId`**: generate a UUID, run the
  `generateTitle` action against the supplied `profile` and
  `firstMessage`, fall back to `"New chat"` if the model returns
  empty, and `storage.threads.create(threadId, title, profileId)`.

### What it does **not** do

- Persist `firstMessage`. The caller decides — some flows just
  want to inspect prior history without writing yet. Follow up
  with [`appendUserMessage`](#appendusermessage) when you do
  want to commit it.
- Touch the thread. Touching happens in
  `appendUserMessage` so the two writes are batched.

---

## `appendUserMessage`

Persist a user message and bump the thread's `lastEditDate` to
`Date.now()` in the same call. The two writes happen in parallel.

### Signature

```ts
async appendUserMessage(
  threadId: string,
  message: ThreadMessageLike,
  profileId?: string
): Promise<string>;
```

The optional `profileId` is forwarded to `threads.touch(...,
{ profileId })`, letting the thread rebind to the active profile
mid-conversation.

### Returns

The newly generated `messageId` (UUID), in case the caller wants
to reference it (e.g. follow up with `messages.update`).

---

## `rename`

Rename a thread and bump `lastEditDate` so the change is visible
in the sidebar. Two writes by necessity — `threads.update`
doesn't bump the timestamp, `threads.touch` doesn't take a title.

### Signature

```ts
async rename(threadId: string, title: string): Promise<void>;
```

### Example

```ts
await engine.rename(threadId, "Q1 retrospective notes");
```

---

## `delete`

Delete the thread. `storage.threads.delete` cascades to messages
per the storage contract — see [`ThreadsStorage`](../storage/storage.md#threadsstorage).

```ts
async delete(threadId: string): Promise<void>;
```

There's no soft-delete and no confirmation — the engine assumes
the caller has handled that in the UI layer.

---

## `clearMessages`

Drop every message in the thread without deleting the thread
itself. Useful for "Clear history" UX where the user wants to
keep the thread row + title but reset the conversation.

```ts
async clearMessages(threadId: string): Promise<void>;
```

Calls `messages.deleteByThread(threadId)` followed by
`threads.touch(threadId, Date.now())`. The thread stays at the
top of the sidebar after the wipe.

---

## `regenerateTitle`

Re-run `generateTitle` against the thread's first user message
and persist the result. Handy when the original auto-title was
poor or when the user asks "rename based on this conversation".

### Signature

```ts
async regenerateTitle(threadId: string, profile: Profile): Promise<string>;
```

### What it does

1. Read the **first** message via
   `storage.messages.readByThread(threadId, 1, 0)`.
2. If there are no messages, throw
   `"Thread has no messages to derive a title from: <id>"`.
3. Run `generateTitle({ profile, messages: [first] })`. Fall back
   to `"New chat"` on empty.
4. Persist via `threads.update` + bump `lastEditDate` via
   `threads.touch`.
5. Return the new title.

### Why the caller passes `profile`

`ThreadsEngine` doesn't reach into `AssignmentsEngine` itself —
that would couple it to assignment resolution. Caller-supplied
`profile` keeps the engine focused on *thread* logic and lets
the same call serve multiple resolution strategies (active chat
profile, original thread profile, an admin-supplied override).

The typical caller flow:

```ts
const { profile } = await assignmentsEngine.resolveForAction(ActionType.Chat);
const newTitle = await threadsEngine.regenerateTitle(threadId, profile);
```

---

## `list` / `readMessages`

Pure passthroughs to the underlying storage methods. Exposed on
the engine so callers that already have a `ThreadsEngine` don't
need to also reach for `storage.threads` / `storage.messages`.

```ts
async list(entityId?: string): Promise<Thread[]>;  // scope-filtered, sorted by lastEditDate desc
async readMessages(
  threadId: string,
  limit?: number,
  startIndex?: number
): Promise<ThreadMessageLike[]>;     // sorted by timestamp asc
```

`list(entityId)` filters threads by the entity scope they were
created in: `undefined` returns only threads bound to no entity,
a string id returns only threads bound to that entity. See
[`StorageAdapter.threads.readAll`](../../../src/core/storage/threads.ts).

---

## Persistence semantics — at a glance

| Trigger                                        | Storage write                                                |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `create`                                       | `threads.create`                                             |
| `openOrCreate`, existing thread                | *no write*                                                   |
| `openOrCreate`, new thread                     | `threads.create` (title from `generateTitle` action)         |
| `appendUserMessage`                            | `messages.create` + `threads.touch`                          |
| `rename`                                       | `threads.update` + `threads.touch`                           |
| `delete`                                       | `threads.delete` (storage cascades to messages)              |
| `clearMessages`                                | `messages.deleteByThread` + `threads.touch`                  |
| `regenerateTitle`                              | `threads.update` + `threads.touch`                           |
| `list` / `readMessages`                        | *no write*                                                   |

---

## Internal helpers

| File                                                                          | Exports                                                | Role |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ---- |
| [`engine.ts`](../../../src/core/services/threads/engine.ts)                    | `ThreadsEngine`                                        | Public class |
| [`types.ts`](../../../src/core/services/threads/types.ts)                      | `ThreadsEngineDeps`, `OpenOrCreateInput`, `OpenOrCreateResult` | Type definitions |
| [`index.ts`](../../../src/core/services/threads/index.ts)                      | barrel                                                 | Re-exports |

---

## Designing on top of `ThreadsEngine`

- **Chat composer / "New chat" button** → use `AIEngine.sendWithStream`
  with `threadId` omitted; it composes `openOrCreate` +
  `appendUserMessage` for you.
- **Sidebar "Rename" action** → `rename`. The single call
  handles both the title write and the timestamp bump.
- **"Clear history" menu item** → `clearMessages`. The thread
  row + title persist; only the messages go.
- **"Regenerate title" menu item** → `regenerateTitle`. Pair it
  with `assignmentsEngine.resolveForAction(ActionType.Chat)` to
  get a profile.
- **Server endpoints that materialize threads from imports** →
  `create` for the bare row, then a series of
  `messages.create` calls (or expose a new bulk-import method
  if this becomes common).

When you find yourself reaching past the engine into
`storage.threads` / `storage.messages` directly for routine
flows, ask whether the rule you'd be bypassing belongs in the
engine instead.
