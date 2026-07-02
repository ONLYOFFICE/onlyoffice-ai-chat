# `WebSearchEngine`

> Source: [`src/core/services/web-search/`](../../../src/core/services/web-search)

`WebSearchEngine` is the persistence + validation orchestrator
for the singleton web-search provider configuration. It wraps
`storage.webSearch` with the rules that plain CRUD can't
express:

- **Live credential validation** before persist — `configure`
  only stores the config when the provider responds OK.
- **Atomic switch** between providers — old config is
  overwritten in one round-trip via
  `storage.webSearch.upsert`.
- **Standalone `testConnection`** for "Test" buttons that should
  not commit on success.

Mirrors the shape of [`ProfilesEngine`](./profiles-engine.md) for
AI provider profiles.

`core/` runs both on the server and the client; this engine has
no DOM / browser APIs anywhere — it uses standard `fetch`
directly. The runtime tool source lives in the same folder
([`source.ts`](../../../src/core/services/web-search/source.ts)) —
`getWebSearchTools(storage)` enumerates the two tools when a
config is persisted, `callWebSearchTool(storage, name, args)`
dispatches them server-side. `AIEngine` resolves both via
[`buildToolContext`](../../../src/core/services/ai/tools.ts).

---

## Construction

```ts
import { WebSearchEngine } from "@/core/services";

const engine = new WebSearchEngine({ storage });
```

```ts
type WebSearchEngineDeps = {
  storage: StorageAdapter;
};
```

The engine is stateless across calls. Share one instance per
`AppContext`.

---

## Methods at a glance

| Method                                  | Returns                              | Persists?                  | Validates? |
| --------------------------------------- | ------------------------------------ | -------------------------- | ---------- |
| [`getActiveConfig`](#getactiveconfig)   | `WebSearchConfig \| null`            | ❌                         | ❌         |
| [`isConfigured`](#isconfigured)         | `boolean`                            | ❌                         | ❌         |
| [`testConnection`](#testconnection)     | `true \| TErrorData`                 | ❌                         | ✅ shape + live |
| [`configure`](#configure)               | `WebSearchMutationResult`            | `webSearch.upsert` (when valid) | ✅ shape + live |
| [`setActiveConfig`](#setactiveconfig)   | `void`                               | `webSearch.upsert`         | ❌         |
| [`clear`](#clear)                       | `void`                               | `webSearch.delete`         | ❌         |

---

## `WebSearchConfig`

```ts
type WebSearchConfig = {
  provider: string;          // e.g. "Exa", "ONLYOFFICE"
  key?: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
  headers?: Record<string, string>; // extra headers for the ONLYOFFICE / cloud backend
};
```

Defined in [`core/storage/web-search.ts`](../storage/storage.md#websearchstorage)
and re-exported from the engine module.

---

## Validation

> Source: [`validation.ts`](../../../src/core/services/web-search/validation.ts)

Two pure helpers, both exported:

```ts
validateConfigShape(config: WebSearchConfig): TErrorData | null;
testWebSearchConnection(config: WebSearchConfig): Promise<true | TErrorData>;
```

### Shape check

`validateConfigShape` runs offline:

| Check                                                                | Failure shape |
| -------------------------------------------------------------------- | ------------- |
| `provider` empty / whitespace                                        | `{ field: "name", message: "Provider is required" }` |
| `isCloudProvider` true (or `provider === "ONLYOFFICE"`) and `baseUrl` missing | `{ field: "url", message: "Base URL is required for cloud provider" }` |
| `baseUrl` not a valid URL                                            | `{ field: "url", message: "Invalid base URL" }` |

### Live check

`testWebSearchConnection` first runs the shape check, then makes
a minimal `numResults: 1` test query POST against the configured
backend (the ONLYOFFICE / cloud branch also carries `engine: "exa"`):

| Provider                                | Endpoint                                                     | Header              |
| --------------------------------------- | ------------------------------------------------------------ | ------------------- |
| `isCloudProvider` or `"ONLYOFFICE"`     | `<baseUrl>/search`                                           | `Authorization: Bearer <key>` (when key present), plus any `config.headers` |
| `"Exa"`                                 | `https://api.exa.ai/search`                                   | `x-api-key: <key>`  |
| anything else                           | rejected as unknown provider                                  | —                   |

Response → `TErrorData` mapping uses the shared
[`ProviderErrors`](../providers/providers.md#providererrors)
factories so error shapes match what AI provider validation
returns:

| HTTP status                  | Result |
| ---------------------------- | ------ |
| 2xx                          | `true` |
| 401                          | `ProviderErrors.invalidKey()` |
| 404                          | `ProviderErrors.invalidUrl()` |
| other, no key supplied       | `ProviderErrors.emptyKey()` |
| other, key supplied          | `ProviderErrors.invalidKey("Request failed with status N")` |
| network throw / cors / DNS   | `ProviderErrors.connectionFailed()` |

UI code can wire `validateConfigShape` directly for live
client-side feedback on the form (no network round-trip), and
fall back to `testWebSearchConnection` only when the user clicks
"Test".

---

## `getActiveConfig` / `isConfigured`

```ts
async getActiveConfig(entityId?: string): Promise<WebSearchConfig | null>;
async isConfigured(entityId?: string): Promise<boolean>;
```

Direct passthroughs. Use them to decide whether the web-search
toggle in the UI should be enabled, or whether to skip
web-search-bound tool sources at chat time.

---

## `testConnection`

```ts
async testConnection(config: WebSearchConfig): Promise<true | TErrorData>;
```

Validates the supplied config without persisting. Idiomatic
"Test" button — the user fills in the form, hits Test, sees
either a success toast or a field-scoped error before deciding
to save. **No `entityId` argument** — `testConnection` only hits
the network, never touches storage.

---

## `configure`

```ts
async configure(
  config: WebSearchConfig,
  entityId?: string
): Promise<WebSearchMutationResult>;

type WebSearchMutationResult =
  | { success: true; config: WebSearchConfig }
  | { success: false; error: TErrorData };
```

1. Run `testWebSearchConnection(config)`.
2. On `true`, call `storage.webSearch.upsert(config, entityId)` —
   single round-trip, idempotent within the requested scope
   (creates on first save, replaces afterwards).
3. Return the persisted config.

`entityId` is opaque and forwarded straight to storage — pass
the `WidgetConfig.entityId` for per-room provider config, or
omit it for the global singleton.

On failure, **nothing is written** — the previous config (if
any) stays in place. Use this when the user clicks "Save" in the
settings form.

---

## `setActiveConfig`

```ts
async setActiveConfig(
  config: WebSearchConfig,
  entityId?: string
): Promise<void>;
```

Persists `config` directly via `storage.webSearch.upsert(config)`
**without** running `testConnection`. Use this when the form
already validates locally on every keystroke and a network
round-trip per blur would be noisy. The settings page in
[`samples/basic`](../../../samples/basic) goes through
`setActiveConfig` for that reason.

When you do want validation before persist, use
[`configure`](#configure) instead.

---

## `clear`

```ts
async clear(entityId?: string): Promise<void>;
```

Reads first to keep the call idempotent — deletion is skipped if
the row is already absent in the requested scope so storage
layers that throw on "delete missing row" stay quiet. Reverts
the requested scope to "web search not configured" and leaves
other scopes untouched.

---

## Persistence semantics — at a glance

| Trigger                                  | Storage write                                                |
| ---------------------------------------- | ------------------------------------------------------------ |
| `getActiveConfig` / `isConfigured`       | *no write* (read-only)                                       |
| `testConnection`                         | *no write* (network only)                                    |
| `configure`, success                     | `webSearch.upsert(config)` — single round-trip               |
| `configure`, validation failure          | *no write*                                                   |
| `setActiveConfig`                        | `webSearch.upsert(config)` — no validation                   |
| `clear`, configured                      | `webSearch.delete()`                                         |
| `clear`, not configured                  | *no write* (idempotent short-circuit)                        |

---

## Internal helpers

| File                                                                          | Exports                                  | Role |
| ----------------------------------------------------------------------------- | ---------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/web-search/engine.ts)                 | `WebSearchEngine`                        | Public class |
| [`source.ts`](../../../src/core/services/web-search/source.ts)                 | `getWebSearchTools`, `callWebSearchTool`, `WEB_SEARCH_TYPE` | Runtime tool source — assembled into the tool list and dispatched by `AIEngine` |
| [`validation.ts`](../../../src/core/services/web-search/validation.ts)         | `validateConfigShape`, `testWebSearchConnection` | Pure shape check + live HTTP test, exported for direct UI use |
| [`types.ts`](../../../src/core/services/web-search/types.ts)                   | `WebSearchEngineDeps`, `WebSearchMutationResult`, re-exported `WebSearchConfig` | Type definitions |
| [`index.ts`](../../../src/core/services/web-search/index.ts)                   | barrel                                   | Re-exports |

---

## Designing on top of `WebSearchEngine`

- **Settings form Save button** → `configure`. The result's
  `error.field` ties straight into your form-error state — same
  shape AI provider profiles use, so the form code is uniform.
- **Settings form Test button** → `testConnection`. No
  persistence; safe to call repeatedly while the user types.
- **"Disable web search" button** → `clear`. Safe to call even
  when nothing is configured.
- **Server endpoints that need to know whether web search is
  available** → `isConfigured` (cheap) or `getActiveConfig`
  (returns the provider name and cloud-flag).
- **Live form-side validation** → import `validateConfigShape`
  directly and run it on every input change. The engine and
  `testConnection` use the same predicate so the experience
  stays consistent end-to-end.

When you find yourself reaching past the engine into
`storage.webSearch` directly, ask whether the rule you'd be
bypassing belongs in the engine instead — particularly the
credential validation, which `WebSearchStorage` does **not**
enforce on its own.
