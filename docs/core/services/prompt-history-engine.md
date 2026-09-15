# `PromptHistoryEngine`

> Source: [`src/core/services/prompt-history/`](../../../src/core/services/prompt-history)

`PromptHistoryEngine` owns the composer's **sent-prompt history** —
the list the user walks with ↑ / ↓ in the input, the way a shell
recalls previous commands. It wraps the optional
`storage.promptHistory` slice with two things raw CRUD doesn't give:

- **Normalization** — blank prompts are never recorded, and sending
  the same text twice in a row collapses into one entry (bash's
  `ignoredups`). Walking history is only useful if consecutive retries
  of one prompt don't bury everything before them.
- **Graceful degradation** — the storage slice is optional. When the
  host adapter predates it, the engine keeps the list in memory, so
  the keys still work for the current session and only persistence
  across reloads is lost.

The scope token is opaque to the engine; the UI passes the **thread
id**, so each chat walks back through its own prompts and a new chat
starts empty. It is deliberately not the message log: it records what
the user *typed and sent*, edits and retries included, rather than the
conversation that resulted.

`core/` runs on both server and client; this engine has no DOM /
browser APIs.

---

## Construction

```ts
import { PromptHistoryEngine } from "@/core/services";

const engine = new PromptHistoryEngine({ storage });

// Or cap the per-scope list at something other than the default 100:
const shortEngine = new PromptHistoryEngine({ storage }, 20);
```

```ts
type PromptHistoryEngineDeps = {
  storage: StorageAdapter;
};
```

---

## Methods

```ts
list(scopeId?: string, limit?: number): Promise<string[]>;
record(text: string, scopeId?: string): Promise<void>;
clear(scopeId?: string): Promise<void>;
```

| Method | Behavior |
| --- | --- |
| `list` | History for the scope, **oldest first / newest last**, capped to `limit` (default `PROMPT_HISTORY_LIMIT`, 100). The cap is re-applied on the result, so an adapter that ignores `limit` still yields a bounded list. |
| `record` | Append a prompt the user just sent. Trims whitespace; drops blanks and an immediate repeat of the newest entry. |
| `clear` | Forget the scope's history. |

### None of them reject

History is a convenience layered on top of the composer, so every
method swallows storage failures: `list` degrades to `[]`, and
`record` / `clear` resolve regardless. Failing to remember a prompt
must never fail the send that triggered it.

### Eviction

The in-memory fallback evicts from the front once the limit is
exceeded. A real backend is free to keep more than `limit` rows — the
engine only bounds what it hands back.

---

## Storage contract

See [`PromptHistoryStorage`](../storage/storage.md#prompthistorystorage)
for the slice this engine drives, including why it is optional and what
a backend has to guarantee.
