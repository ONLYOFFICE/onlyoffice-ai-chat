# `AttachmentsEngine`

> Source: [`src/core/services/attachments/engine.ts`](../../../src/core/services/attachments/engine.ts)

Thin orchestrator over `storage.attachments`. Composer drafts call
it through `api.attachments` (in-process when no `origin`/`baseUrl`
is configured, over HTTP otherwise — same routing pattern as the
other engines) to persist a file or image payload up front, keep
only a lightweight `{id, title, kind, ...}` ref in memory, and
bind the draft refs to their owning message after the user
message has been persisted.

Routes are declared in
[`DEFAULT_ATTACHMENTS_ROUTES`](../../../src/core/services/attachments/types.ts) —
all methods route under `attachments/*`. `delete` / `deleteMany`
use the `DELETE` verb for idiomatic REST; `get` / `getMany` are
`POST` because their inputs (id / ids array) belong in the body
rather than the query string.

The full payload (file text content, image base64) lives in
`storage.attachments`. Right before the provider sees a message,
`AIEngine` walks the message history and calls
[`resolveAttachmentRefs`](../../../src/core/actions/attachment-resolution.ts)
to swap each ref for its hydrated inline form (`{type:"file", data,
mimeType}` / `{type:"image", image: base64}`). Providers see the
familiar fully-hydrated shape — they were not modified.

## Why ref-only persistence?

- Threads load fast even with many attachments, because IndexedDB
  reads only metadata until the resolver actually needs the
  payload.
- The middleware contract (`runBeforeSend`, `onMessageSent`) ships
  refs by default, so middleware authors do not pull tens of MB
  of base64 through every hook.
- `messages.delete` and `messages.deleteByThread` cascade to
  `attachments.deleteByMessage` / `deleteByThread` on the storage
  side, so removing history also reclaims storage.

## API

```ts
class AttachmentsEngine {
  constructor(deps: { storage: StorageAdapter });

  saveFile(
    input: { path: string; content: string; type: number; title?: string },
    entityId?: string
  ): Promise<Attachment>;

  saveImage(
    input: { name: string; base64: string; title?: string },
    entityId?: string
  ): Promise<Attachment>;

  deleteMany(ids: string[]): Promise<void>;

  get(id: string): Promise<Attachment | null>;
  getMany(ids: string[]): Promise<(Attachment | null)[]>;
  delete(id: string): Promise<void>;

  linkToMessage(
    ids: string[],
    messageId: string,
    threadId: string
  ): Promise<void>;
}
```

`saveFile` / `saveImage` write to `storage.attachments.create`,
which assigns the `id` and `createdAt`. The engine never
synthesizes them.

## How drafts and refs flow

```
[Composer / DnD]            (1) addAttachmentFile / addAttachmentImage
        │
        ▼
[AttachmentsEngine.save*] ─► storage.attachments.create
        │                         (id assigned here)
        ▼
[Zustand draft]: TAttachmentRef[]
        │
        │  user clicks Send
        ▼
[useMessages.onNew]
   builds content[] with ref-blocks via buildFileRefBlock /
   buildImageRefBlock — `data` / `image` carry only ref id + title
        │
        ▼
[AIEngine.sendWithStream]
   1. persist user message via storage.messages.create
   2. linkAttachments(...) — patch every ref with messageId/threadId
   3. resolveAttachmentRefs(...) — hydrate refs to inline form
   4. provider.sendMessage(hydrated)
```

Drafts the user adds and then never sends are intentionally left
as orphans for now (no GC sweep). The plan to revisit this is
tracked in the project memory.

## Storage cascade

The IndexedDB implementation in
[`samples/basic/src/adapters/storage.ts`](../../../samples/basic/src/adapters/storage.ts)
calls `attachments.deleteByMessage(messageId)` from
`IDBMessages.delete()` and `attachments.deleteByThread(threadId)`
from `IDBMessages.deleteByThread()`. Custom backends must do the
same — see [`src/core/storage/messages.ts`](../../../src/core/storage/messages.ts)
for the contract.
