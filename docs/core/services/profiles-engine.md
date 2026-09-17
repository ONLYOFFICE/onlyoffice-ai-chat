# `ProfilesEngine`

> Source: [`src/core/services/profiles/`](../../../src/core/services/profiles)

`ProfilesEngine` is the lifecycle orchestrator for
[`Profile`](../../../src/types.ts) records. It wraps
`storage.profiles` with the business rules that plain CRUD can't
express on its own:

- **Name uniqueness** on `create` and `update` (case-insensitive).
- **Credential validation** — pings the concrete provider class
  before the profile is persisted.
- **Default-slot bootstrap** — the first profile ever created is
  auto-assigned to `ActionType.Default`.
- **Cascading cleanup** of `storage.assignments` rows when a
  profile is deleted, including promoting a new `Default` if the
  deleted profile held that slot.
- **Tool-capability probe** — before persisting a `create`, and on
  any `update` that changes `modelId` / `providerType` / `baseUrl`,
  the engine asks the configured model to call a fake MCP tool
  and stores the boolean outcome in `Profile.canUseTool`. Runtime
  actions read this flag to switch into the text-protocol fallback
  for models without native function-calling. See
  [`probe-tools.ts`](../../../src/core/services/profiles/probe-tools.ts).
- **Storage + provider joins** for `listModels` and
  `testConnection` — single calls that fetch the profile, look
  up the provider class, and run the relevant provider method.

Plain CRUD on `storage.profiles` is still available; reach for the
engine when you want any of the rules above to apply.

---

## Construction

```ts
import { ProfilesEngine } from "@/core/services";

const engine = new ProfilesEngine({ storage });
```

```ts
type ProfilesEngineDeps = {
  storage: StorageAdapter;
  /**
   * Optional — the engine constructs its own `AssignmentsEngine`
   * from `storage` when omitted. Pass an existing instance to share
   * a single sub-engine across `ProfilesEngine` and `AIEngine`.
   */
  assignments?: AssignmentsEngine;
  /**
   * Optional — the same transport switches `AIEngineDeps` takes. The
   * capability probe run on `create` / `update` reaches the model the
   * way chat will (`useProxy` / `forceProxy` → `fetchProxy`,
   * `providerType: "external"` → `externalFetch`), so a host that only
   * allows proxied traffic does not get a false `canUseTool: false`.
   */
  fetchProxy?: ProviderFetch;
  forceProxy?: boolean | (() => boolean);
  externalFetch?: ProviderFetch;
};
```

The engine is stateless — share one instance per `AppContext`.

---

## Methods at a glance

| Method                               | Returns                                | Persists?                          | Validates? |
| ------------------------------------ | -------------------------------------- | ---------------------------------- | ---------- |
| [`create`](#create)                  | `ProfileMutationResult`                | `profiles` (+ `assignments` if first) | ✅ name + credentials |
| [`update`](#update)                  | `ProfileMutationResult`                | `profiles`                         | ✅ name + credentials |
| [`delete`](#delete)                  | `void`                                 | `profiles` + cascading `assignments` | ❌ |
| [`listModels`](#listmodels)          | `Model[]`                              | ❌                                  | ❌ |
| [`listProviderModels`](#listprovidermodels) | `Model[]`                              | ❌                                  | ❌ |
| [`testConnection`](#testconnection)  | `true \| TErrorData`                   | ❌                                  | ✅ credentials only |
| [`getById`](#getbyid--list)          | `Profile \| undefined`                 | ❌                                  | ❌ |
| [`list`](#getbyid--list)             | `Profile[]`                            | ❌                                  | ❌ |

---

## `create`

Validate, generate identity fields, persist, and (if applicable)
auto-assign the new profile to the `Default` slot.

### Signature

```ts
async create(input: CreateProfileInput): Promise<ProfileMutationResult>;
```

```ts
type CreateProfileInput = Omit<Profile, "id" | "createdAt">;

type ProfileMutationResult =
  | { success: true; profile: Profile }
  | { success: false; error: TErrorData };

type TErrorData = {
  field: "key" | "url" | "name";
  message: string;
};
```

### What it does

1. **Read existing profiles** via `storage.profiles.readAll()`.
2. **Validate** the input through
   [`validateProfile`](../../../src/core/services/profiles/validation.ts):
   - Case-insensitive name uniqueness against the existing list →
     `{ field: "name", message: "Duplicate name" }` on collision.
   - Credentials: `getProvider(input.providerType).checkProvider({
     baseUrl, apiKey: input.key })`. Truthy boolean / `TErrorData` /
     thrown errors are normalized to `TErrorData`. Unknown
     `providerType` → `{ field: "name", message: "Unknown
     provider type: <type>" }`.
3. **Probe tool capability** via
   [`probeToolCapability`](../../../src/core/services/profiles/probe-tools.ts).
   The probe issues a single streaming request with a fake MCP
   tool and a 15-second timeout, returns `true` iff the model
   emits a `tool-call` part, and never throws (network / abort /
   provider errors collapse to `false`). The result is stored
   verbatim in `Profile.canUseTool`.
4. **Persist** via `storage.profiles.create({ ...input, canUseTool })`.
   The engine generates `id` and `createdAt` itself.
5. **Auto-assign default.** If `existing.length === 0`, also call
   `storage.assignments.create("Default", profile.id)`. Per-action
   slots (`Chat`, `Summarization`, …) stay unset — the user opts
   into those explicitly through the UI.
6. **Return** `{ success: true, profile }`.

On failure, **nothing is written** — the engine returns
`{ success: false, error }` and the caller can show a field-scoped
message in the UI.

### Example

```ts
const result = await engine.create({
  name: "Anthropic prod",
  providerType: "anthropic",
  baseUrl: "https://api.anthropic.com",
  key: process.env.KEY,
  modelId: "claude-sonnet-4-20250514",
  reasoning: true,
  capabilities: 0b0001_0011,
});

if (!result.success) {
  // result.error.field is one of "name" | "key" | "url"
  showFieldError(result.error.field, result.error.message);
} else {
  router.push(`/profiles/${result.profile.id}`);
}
```

---

## `update`

Same validation rules as `create`, applied to an existing profile.
The previous version is overwritten in place — there's no version
history.

### Signature

```ts
async update(profile: Profile): Promise<ProfileMutationResult>;
```

### What it does

1. **Existence check.** If `profile.id` is not in
   `storage.profiles.readAll()`, return
   `{ success: false, error: { field: "name", message: "Profile not found" } }`.
2. **Validate** with `excludeId = profile.id` so the profile's own
   name doesn't collide with itself. Credentials are re-checked
   even if `key` / `baseUrl` haven't changed — keeping the rule
   uniform avoids "saved valid, drifted invalid" silently.
3. **Conditional re-probe.** `canUseTool` is recomputed via
   `probeToolCapability` only when `modelId`, `providerType`, or
   `baseUrl` differ from the previous version. A pure rename keeps
   the existing flag (no extra round-trip).
4. **Persist** via `storage.profiles.update({ ...profile, canUseTool })`.
5. **Return** the updated profile.

`update` does **not** touch `storage.assignments`. If the user
changes `providerType`, existing assignments still point at this
profile — the assumption is that a working credential check is
enough; per-action capability filtering happens in the UI layer.

### Example

```ts
const next: Profile = { ...current, modelId: "claude-opus-4-7" };
const result = await engine.update(next);
if (!result.success) showFieldError(result.error.field, result.error.message);
```

---

## `delete`

Remove a profile, cascading to `storage.assignments` first so we
never leave orphan rows pointing at a deleted ID.

### Signature

```ts
async delete(id: string): Promise<void>;
```

### What it does

The cascade is delegated to
[`AssignmentsEngine.cascadeProfileDelete`](./assignments-engine.md#cascadeprofiledelete)
and runs **before** `storage.profiles.delete(id)`:

1. **Read every assignment** via `storage.assignments.readAll()`.
2. **Default-slot promotion.** If the deleted profile is the
   current `Default`:
   - If at least one other profile remains in
     `storage.profiles.readAll()`, promote the *first* one
     (insertion order) to `Default` via
     `storage.assignments.update("Default", next.id)`.
   - Otherwise drop the `Default` assignment entirely with
     `storage.assignments.delete("Default")`.
3. **Drop orphans.** For every other action type whose assignment
   referenced the deleted profile, call
   `storage.assignments.deleteMany([...])`. There is **no**
   automatic fallback to `Default` for these — once a per-action
   slot is unset, dispatch falls back to `Default` at call time
   (see [`AIEngine`](./ai-engine.md#sendwithstream)).
4. **Delete the profile** itself.

The order matters: the cascade reads `storage.profiles.readAll()`
to pick a replacement default, so the deleted profile must still
be present at that read.

### Example

```ts
await engine.delete(profileId);
// Any assignments that pointed at this ID are gone or re-pointed.
// `Default` is either reassigned, or unset if no profiles remain.
```

---

## `listModels`

Fetch the list of models the provider exposes for a given profile.
A storage + provider join, encapsulated as a single call.

### Signature

```ts
async listModels(profileId: string): Promise<Model[]>;
```

### What it does

1. `loadProfile(storage, profileId)` — read the profile, throw
   `"Profile not found: <id>"` if missing.
2. `providerFor(profile.providerType)` — resolve the registered
   provider class, throw `"Unknown provider type: <type>"` if not
   registered.
3. `Provider.getProviderModels({ baseUrl, apiKey: profile.key })`
   — delegate to the static method on the provider class.

`listModels` does **not** validate the credentials first. If the
provider rejects the request, the underlying error propagates
unchanged.

### Example

```ts
const models = await engine.listModels(profileId);
setModelOptions(models);
```

---

## `listProviderModels`

Same as [`listModels`](#listmodels) but takes raw credentials
instead of a stored profile id. Used by the "add provider" form,
where the user has typed a key but the profile does not exist yet
— and by hosts that want this lookup routed through their core
(`api.profiles.listProviderModels(...)` proxies to
`POST profiles/list-provider-models`) so the browser does not call
the provider API directly.

### Signature

```ts
async listProviderModels(input: {
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
}): Promise<Model[]>;
```

### What it does

1. `providerFor(input.providerType)` — resolve the registered
   provider class, throw `"Unknown provider type: <type>"` if not
   registered.
2. `Provider.getProviderModels({ baseUrl, apiKey })` — delegate to
   the static method on the provider class. No storage access.

Errors from the provider propagate unchanged.

---

## `testConnection`

Run the same credential check `create` and `update` use, but
without any persistence and against a profile that already exists
in storage.

### Signature

```ts
async testConnection(profileId: string): Promise<true | TErrorData>;
```

Returns `true` on success, otherwise a normalized `TErrorData`
matching the `create` / `update` failure shape.

### Example

```ts
const result = await engine.testConnection(profileId);
if (result === true) toast("Connection OK");
else showFieldError(result.field, result.message);
```

---

## `getById` / `list`

Direct passthroughs to `storage.profiles.readById` /
`storage.profiles.readAll` — no business logic, just a single-API
surface for callers that already hold the engine (e.g. routed
through `api.profiles.*` over HTTP).

```ts
async getById(id: string): Promise<Profile | undefined>;
async list(): Promise<Profile[]>;
```

---

## Validation rules

Centralised in
[`validation.ts`](../../../src/core/services/profiles/validation.ts):

```ts
export async function validateProfile(
  existing: Profile[],
  input: Pick<Profile, "name" | "providerType" | "baseUrl" | "key">,
  excludeId?: string
): Promise<TErrorData | null>;
```

The function is intentionally pure with respect to its inputs —
the caller supplies the existing profile list, so the validator
can be unit-tested without mocking storage.

| Check                  | Failure shape                                                                |
| ---------------------- | ---------------------------------------------------------------------------- |
| Name collision         | `{ field: "name", message: "Duplicate name" }`                              |
| Unknown provider       | `{ field: "name", message: "Unknown provider type: <type>" }`               |
| `checkProvider` returns `false` / non-`TErrorData` | `{ field: "key", message: "Provider validation failed" }` |
| `checkProvider` returns `TErrorData` | the returned object verbatim |

`checkProvider` is a static method on each provider class —
`Anthropic`, `OpenAI`, etc. The provider chooses which field
(`key` or `url`) to flag.

---

## Internal helpers

| File                                                                           | Exports                                       | Role |
| ------------------------------------------------------------------------------ | --------------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/profiles/engine.ts)                    | `ProfilesEngine`                              | Public class |
| [`types.ts`](../../../src/core/services/profiles/types.ts)                      | `ProfilesEngineDeps`, `CreateProfileInput`, `ProfileMutationResult` | Type definitions |
| [`validation.ts`](../../../src/core/services/profiles/validation.ts)            | `validateProfile`, `checkCredentials`         | Name uniqueness + provider credential check |
| (delegated)                                                                    | [`AssignmentsEngine.cascadeProfileDelete`](./assignments-engine.md#cascadeprofiledelete) | Default-slot promotion + orphan cleanup |
| [`lookup.ts`](../../../src/core/services/profiles/lookup.ts)                    | `loadProfile`, `providerFor`, `credsOf`       | Storage / provider lookup helpers |
| [`probe-tools.ts`](../../../src/core/services/profiles/probe-tools.ts)          | `probeToolCapability`                         | Live tool-capability probe (2 min timeout, never throws) |
| [`index.ts`](../../../src/core/services/profiles/index.ts)                      | barrel                                        | Re-exports `ProfilesEngine` and public types |

---

## Persistence semantics — at a glance

| Trigger                                  | Storage write                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `create`, success, first profile         | `profiles.create` + `assignments.create("Default", id)`                         |
| `create`, success, not first             | `profiles.create`                                                               |
| `create`, failure                        | *no write*                                                                      |
| `update`, success                        | `profiles.update`                                                               |
| `update`, failure                        | *no write*                                                                      |
| `delete`, deleted holds `Default`, others remain | `assignments.update("Default", next.id)` + (`assignments.deleteMany` if orphans) + `profiles.delete` |
| `delete`, deleted holds `Default`, last profile  | `assignments.delete("Default")` + `profiles.delete`                     |
| `delete`, only orphan per-action assignments     | `assignments.deleteMany([...])` + `profiles.delete`                     |
| `listModels`, `testConnection`, `getById`, `list` | *no write*                                                             |

---

## Designing on top of `ProfilesEngine`

- **Profile creation flows** → `create`. Pipe the
  `TErrorData.field` straight into your form-error state.
- **Settings page edits** → `update`. Re-check on every save —
  cheaper than letting a stale credential silently break a chat.
- **Profile deletion UX** → `delete`. The cascade is automatic;
  you don't need to manually clean up assignments. Just refresh
  the profile list and the `Default` indicator afterwards.
- **Model picker dropdown** → `listModels`. Cache the result if
  the provider has a slow `getProviderModels` (e.g. a network
  round-trip).
- **"Test connection" button** → `testConnection`. Cheap, no
  persistence, identical guarantees to `create` / `update`.

If you find yourself reaching past the engine into
`storage.profiles` directly, ask whether the rule you'd be
bypassing belongs in the engine instead — keep the bypasses for
clearly read-only or admin-tool code paths.
