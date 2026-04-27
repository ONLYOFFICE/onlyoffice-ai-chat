# `PreferencesEngine`

> Source: [`src/core/services/preferences/`](../../../src/core/services/preferences)

`PreferencesEngine` wraps `storage.preferences` with two
conveniences that plain CRUD doesn't provide:

- **Default fallback** — `getDeepMode()` returns the configured
  default when no value has been persisted, so callers don't
  have to handle the `null` from `readDeepMode()` themselves.
- **Idempotent writes** — `setDeepMode(value)` collapses the
  `create` / `update` branch into a single
  `storage.preferences.upsertDeepMode` call.

Today the engine surfaces a single preference (the deep-mode
toggle), but the shape is intentionally extensible: adding a new
scalar preference is mechanical — see
[Adding a new preference](#adding-a-new-preference).

`core/` runs on both server and client; this engine has no DOM /
browser APIs.

---

## Construction

```ts
import { PreferencesEngine } from "@/core/services";

const engine = new PreferencesEngine({ storage });

// Or override built-in defaults:
const eagerEngine = new PreferencesEngine(
  { storage },
  { deepMode: true }
);
```

```ts
type PreferencesEngineDeps = {
  storage: StorageAdapter;
};

type PreferenceDefaults = {
  deepMode: boolean;
};
```

The second constructor argument lets the host substitute defaults
for any preference. Unspecified keys fall back to
[`DEFAULT_PREFERENCES`](../../../src/core/services/preferences/types.ts).

---

## Methods at a glance

| Method                                  | Returns                  | Persists?                       | Default? |
| --------------------------------------- | ------------------------ | ------------------------------- | -------- |
| [`getDeepMode`](#getdeepmode)           | `boolean`                | ❌                              | ✅ falls back to default |
| [`setDeepMode`](#setdeepmode)           | `void`                   | `preferences.upsertDeepMode`    | —        |
| [`clearDeepMode`](#cleardeepmode)       | `void`                   | `preferences.deleteDeepMode`    | —        |
| [`isDeepModeSet`](#isdeepmodeset)       | `boolean`                | ❌                              | —        |

---

## Deep mode (extended thinking)

The deep-mode toggle gates whether `withReasoning` is forwarded to
streaming chat. Per-provider behaviour:
[`AIEngine`](./ai-engine.md) reads `actionArgs.isReasoning` from
the caller; the host typically threads `engine.getDeepMode()`
into that arg.

### `getDeepMode`

```ts
async getDeepMode(): Promise<boolean>;
```

Returns the persisted value if one exists, otherwise the
configured default. **Never returns `null`** — that's the whole
point of having an engine over the storage.

### `setDeepMode`

```ts
async setDeepMode(value: boolean): Promise<void>;
```

Idempotent — uses `upsertDeepMode` so callers don't have to
branch on whether the row has been written before. Persists the
value verbatim, including `false` (an explicit "off" is preserved
across reloads, distinct from "never set").

### `clearDeepMode`

```ts
async clearDeepMode(): Promise<void>;
```

Removes the persisted value. Future `getDeepMode` calls fall back
to the default. Use for "Reset to default" UX.

### `isDeepModeSet`

```ts
async isDeepModeSet(): Promise<boolean>;
```

True if the user has explicitly persisted *some* value (regardless
of whether it's `true` or `false`). Use this to distinguish
"opted in/out" from "never set" — for example when the UI wants
to show a "Default" badge on the toggle.

---

## Adding a new preference

The next obvious migration target is the **system-prompt
appendix** currently exposed through the widget's
[imperative API](../../imperative-api.md#system-prompt-appendix).
Moving it onto `PreferencesEngine` would make it available
headless and on the server, identical to deep mode.

The mechanical steps:

1. Extend `PreferencesStorage` with a typed quartet plus an
   upsert:
   ```ts
   createSystemPromptAppendix(value: string): Promise<void>;
   readSystemPromptAppendix(): Promise<string | null>;
   updateSystemPromptAppendix(value: string): Promise<void>;
   upsertSystemPromptAppendix(value: string): Promise<void>;
   deleteSystemPromptAppendix(): Promise<void>;
   ```
2. Add the matching field to `PreferenceDefaults` (likely
   `systemPromptAppendix: ""`).
3. Add `getSystemPromptAppendix` / `setSystemPromptAppendix` /
   `clearSystemPromptAppendix` / `isSystemPromptAppendixSet`
   methods on the engine, mirroring the deep-mode quartet.
4. Update the widget's imperative-API surface to delegate to
   the engine instead of writing to `SettingsAdapter` directly.

The pattern is shared across every scalar preference — an engine
method for each of `get`/`set`/`clear`/`isSet`, a storage method
for each of `create`/`read`/`update`/`upsert`/`delete`. Keep the
two in lockstep and the contract stays self-documenting.

---

## Persistence semantics — at a glance

| Trigger                                  | Storage write                                                |
| ---------------------------------------- | ------------------------------------------------------------ |
| `getDeepMode` / `isDeepModeSet`          | *no write* (read-only)                                       |
| `setDeepMode(value)`                     | `preferences.upsertDeepMode(value)`                          |
| `clearDeepMode`                          | `preferences.deleteDeepMode()` (no-op if missing)            |

---

## Internal helpers

| File                                                                              | Exports                                  | Role |
| --------------------------------------------------------------------------------- | ---------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/preferences/engine.ts)                    | `PreferencesEngine`                      | Public class |
| [`types.ts`](../../../src/core/services/preferences/types.ts)                      | `PreferencesEngineDeps`, `PreferenceDefaults`, `DEFAULT_PREFERENCES` | Type definitions + built-in defaults |
| [`index.ts`](../../../src/core/services/preferences/index.ts)                      | barrel                                   | Re-exports |

---

## Designing on top of `PreferencesEngine`

- **Toggle in the settings panel** → `setDeepMode(value)`. Read
  `getDeepMode()` for the initial state.
- **"Reset to default" menu item** → `clearDeepMode`.
- **`AIEngine.sendWithStream` callsites** → resolve
  `getDeepMode()` once and thread it through `actionArgs.isReasoning`.
  The engine is fast (single storage read with default fallback)
  so caching at the call site is rarely worth it.
- **SSR / server endpoint that needs the user's preference** →
  `getDeepMode()` works out of the box; the host injects whatever
  `StorageAdapter` it has.

When you find yourself reading `storage.preferences.readDeepMode()`
directly and writing the `null` fallback inline, prefer this
engine — collapsing the default into one place keeps the rest of
the codebase from drifting into inconsistent fallbacks.
