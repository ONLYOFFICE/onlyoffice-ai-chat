# `AssignmentsEngine`

> Source: [`src/core/services/assignments/`](../../../src/core/services/assignments)

`AssignmentsEngine` is the orchestrator for the
`ActionType → profileId` map. It wraps `storage.assignments` with
the rules that plain CRUD can't express:

- **Profile resolution** with `Default` fallback for action
  dispatch — the single source of truth used by
  [`AIEngine`](./ai-engine.md).
- **Capability validation** — refuse to bind a profile that
  doesn't declare the required `CapabilitiesUI` bits for the
  slot, so misconfiguration surfaces at write time rather than at
  send time.
- **Idempotent writes** — upsert semantics so callers don't have
  to branch on `create` vs `update`.
- **Bulk-assign** with all-or-nothing transactional semantics.
- **Default-promotion** on profile delete — the cascade hook
  `ProfilesEngine.delete` runs before dropping the profile row.

`core/` runs both on the server and the client; this engine has
no DOM / browser APIs anywhere.

---

## Construction

```ts
import { AssignmentsEngine } from "@/core/services";

const engine = new AssignmentsEngine({ storage });
```

```ts
type AssignmentsEngineDeps = {
  storage: StorageAdapter;
};
```

The engine is stateless across calls. Share one instance per
`AppContext` and pass it into `AIEngine` / `ProfilesEngine` to
avoid duplicating capability rules.

---

## Methods at a glance

| Method                                                           | Returns                              | Persists?              | Validates? |
| ---------------------------------------------------------------- | ------------------------------------ | ---------------------- | ---------- |
| [`resolveForAction`](#resolveforaction)                          | `ResolvedAssignment`                 | ❌                     | ❌ (read-only) |
| [`tryResolveForAction`](#tryresolveforaction)                    | `ResolvedAssignment \| null`         | ❌                     | ❌         |
| [`assign`](#assign)                                              | `AssignmentMutationResult`           | `assignments`          | ✅ existence + capabilities |
| [`unassign`](#unassign)                                          | `void`                               | `assignments`          | ❌         |
| [`bulkAssign`](#bulkassign)                                      | `BulkAssignmentResult`               | `assignments` (all-or-nothing) | ✅ existence + capabilities (every entry) |
| [`getAssignment`](#getassignment) / [`getAllAssignments`](#getallassignments) | `string \| null` / `Partial<Record<…>>` | ❌                     | ❌         |
| [`cascadeProfileDelete`](#cascadeprofiledelete)                  | `void`                               | `assignments`          | ❌         |

---

## Capability requirements

> Source: [`requirements.ts`](../../../src/core/services/assignments/requirements.ts)

Each `ActionType` declares the minimum `CapabilitiesUI` bits a
profile must support to be a valid binding target.

| `ActionType`        | Required bits          |
| ------------------- | ---------------------- |
| `Default`           | (none — fallback slot) |
| `Chat`              | `Chat`                 |
| `Summarization`     | `Chat`                 |
| `Translation`       | `Chat`                 |
| `TextAnalyze`       | `Chat`                 |
| `ImageGeneration`   | `Image`                |
| `OCR`               | `Vision`               |
| `Vision`            | `Vision`               |

Profiles with `capabilities` undefined or `0` have no declared
support and only satisfy the empty `Default` requirement. This
keeps the validator forward-compatible — when capabilities later
grow new bits, profiles created today still pass.

The mapping is exported as `ACTION_REQUIREMENTS`, and the
predicate as `meetsRequirements(profile, actionType)`. UI code
that wants to filter "profiles eligible for this slot" should
reach for `meetsRequirements` directly:

```ts
import { meetsRequirements } from "@/core/services";

const eligible = profiles.filter((p) => meetsRequirements(p, ActionType.Vision));
```

---

## `resolveForAction`

The single source of truth for "which profile should run this
action right now?". Used by `AIEngine` for every public method.

### Signature

```ts
async resolveForAction(
  actionType: ActionType,
  /** Opaque scope token — see WidgetConfig.entityId. */
  entityId?: string
): Promise<ResolvedAssignment>;

type ResolvedAssignment = { profileId: string; profile: Profile };
```

### What it does

1. `storage.assignments.readByType(actionType, entityId)` —
   scoped direct lookup. Storage typically honours `entityId`
   only when `actionType === ActionType.Chat`, returning a
   per-room chat profile when one is configured.
2. If `null`, fall back to
   `storage.assignments.readByType(ActionType.Default)` —
   **always unscoped**, since the engine treats per-entity
   defaults as out of scope.
3. If both are `null`, throw
   `"No profile assigned to ActionType.<X> and no default set"`.
4. Read the resolved profile from `storage.profiles`.
5. If the row is missing, throw
   `"Assigned profile not found: <id>"` — the assignment table
   has a dangling pointer (e.g. host mutated profiles out of band
   without going through `ProfilesEngine.delete`).

### When to use it

- Dispatching an action — let `AIEngine` do this for you, but
  reach for `resolveForAction` directly if you're building a
  custom action runner.
- Pre-flight checks where the absence of a profile is exceptional
  (auto-flow, server-side render gates).

For non-fatal use cases (rendering a "not configured" hint),
prefer [`tryResolveForAction`](#tryresolveforaction).

---

## `tryResolveForAction`

Same lookup logic as `resolveForAction`, but returns `null`
instead of throwing when both the specific slot and `Default` are
empty.

```ts
async tryResolveForAction(
  actionType: ActionType,
  entityId?: string
): Promise<ResolvedAssignment | null>;
```

The "assigned profile not found" branch still throws — a dangling
pointer is a data-integrity bug, not an empty-state.

### Example

```ts
const resolved = await engine.tryResolveForAction(ActionType.Vision);
if (!resolved) showHint("Configure a vision-capable profile in Settings");
else runOcrPreview(resolved.profile);
```

---

## `assign`

Bind `profileId` to `actionType`. Validates that the profile
exists and that its `capabilities` meet the slot's requirements
(except for `Default`, which has no requirement).

### Signature

```ts
async assign(
  actionType: ActionType,
  profileId: string
): Promise<AssignmentMutationResult>;

type AssignmentMutationResult =
  | { success: true }
  | { success: false; error: TErrorData };
```

### What it does

1. **Existence check.** `storage.profiles.readById(profileId)` →
   `{ field: "name", message: "Profile not found" }` on miss.
2. **Capability check.** If `actionType !== Default` and
   `meetsRequirements(profile, actionType) === false`, return
   `{ field: "name", message: "Profile lacks capabilities required for ActionType.<X>" }`.
3. **Upsert.** Single
   [`assignments.upsertMany({ [actionType]: profileId })`](../storage/storage.md#assignmentsstorage)
   call — creates the row when empty, replaces it when bound to
   a different profile, no-op when bound to the same profile.
   One round-trip whether the row exists or not.

### Errors

`assign` does **not** throw on user-input issues — it returns
`{ success: false, error }` so the profile editor can show a
field-scoped message. It *does* propagate storage errors thrown
by the adapter (e.g. database connectivity failure).

### Example

```ts
const result = await engine.assign(ActionType.OCR, profileId);
if (!result.success) showError(result.error.message);
```

---

## `unassign`

Drop the binding for `actionType`. No-op if the slot was already
empty.

```ts
async unassign(actionType: ActionType): Promise<void>;
```

After `unassign`, `resolveForAction(actionType)` will fall back
to the `Default` slot if it's set, or throw otherwise.

---

## `bulkAssign`

Apply many bindings at once with **all-or-nothing** semantics —
every entry is validated first, then all writes happen, or no
writes happen at all.

### Signature

```ts
async bulkAssign(
  map: Partial<Record<ActionType, string>>
): Promise<BulkAssignmentResult>;

type BulkAssignmentResult =
  | { success: true }
  | {
      success: false;
      errors: Array<{ actionType: ActionType; error: TErrorData }>;
    };
```

### What it does

1. **Read all referenced profiles in parallel.**
2. **Collect errors.** For each entry: missing profile or
   capability mismatch produces an `errors` row. Empty bitmasks
   (capabilities `undefined` / `0`) only satisfy `Default`.
3. **All-or-nothing write.** If `errors.length === 0`, hand the
   full map to
   [`assignments.upsertMany`](../storage/storage.md#assignmentsstorage)
   for a single transactional write. Otherwise return
   `{ success: false, errors }` and write nothing.

### When to use it

- Onboarding wizards that pick all task slots at once.
- Settings panels with a "Save" button that commits multiple
  slot changes.
- Server endpoints that import a config bundle.

### Example

```ts
const result = await engine.bulkAssign({
  [ActionType.Chat]: chatProfileId,
  [ActionType.Summarization]: chatProfileId,
  [ActionType.Vision]: visionProfileId,
});
if (!result.success) {
  for (const { actionType, error } of result.errors) {
    showFieldError(actionType, error);
  }
}
```

---

## `getAssignment` / `getAllAssignments`

Direct passthroughs to `storage.assignments.readByType` and
`storage.assignments.readAll` — no business logic, just a
single-API surface for callers that already have the engine.

```ts
async getAssignment(actionType: ActionType): Promise<string | null>;
async getAllAssignments(): Promise<Partial<Record<ActionType, string>>>;
```

---

## `cascadeProfileDelete`

The cascade hook called by `ProfilesEngine.delete` **before**
`storage.profiles.delete(id)` runs.

```ts
async cascadeProfileDelete(profileId: string): Promise<void>;
```

### What it does

1. **Read every assignment** via `storage.assignments.readAll()`.
2. **Default-slot promotion.** If `profileId` is the current
   `Default`:
   - If at least one other profile remains in
     `storage.profiles.readAll()`, promote the *first* one
     (insertion order) to `Default` via
     `assignments.update("Default", next.id)`.
   - Otherwise drop the `Default` assignment with
     `assignments.delete("Default")`.
3. **Drop orphans.** Every per-action slot that pointed at the
   deleted profile is dropped via `assignments.deleteMany([...])`.
   No automatic fallback to `Default` for these — once a slot is
   unset, dispatch falls back to `Default` at call time.

The order matters: the cascade reads `storage.profiles.readAll()`
to pick a replacement default, so the deleted profile must still
be present at that read.

### When to use it

- Always called by `ProfilesEngine.delete` automatically.
- Call manually if your code path bypasses `ProfilesEngine` and
  edits `storage.profiles` directly — but prefer fixing the call
  path to go through the engine instead.

---

## Persistence semantics — at a glance

| Trigger                                  | Storage write |
| ---------------------------------------- | ------------- |
| `resolveForAction` / `tryResolveForAction` | *no write* (read-only) |
| `assign`, success                        | `assignments.upsertMany({ [actionType]: profileId })` (single round-trip; idempotent for same-value writes) |
| `assign`, failure                        | *no write* |
| `unassign`                               | `assignments.delete` (no-op if missing) |
| `bulkAssign`, success                    | `assignments.upsertMany(map)` — one transaction |
| `bulkAssign`, failure                    | *no write* |
| `cascadeProfileDelete`, deleted holds `Default`, others remain | `assignments.update("Default", next.id)` (+ `deleteMany` if orphans) |
| `cascadeProfileDelete`, deleted holds `Default`, last profile  | `assignments.delete("Default")` |
| `cascadeProfileDelete`, only orphan per-action assignments      | `assignments.deleteMany([...])` |

---

## Internal helpers

| File                                                                              | Exports                                | Role |
| --------------------------------------------------------------------------------- | -------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/assignments/engine.ts)                    | `AssignmentsEngine`                    | Public class |
| [`requirements.ts`](../../../src/core/services/assignments/requirements.ts)        | `ACTION_REQUIREMENTS`, `meetsRequirements` | `ActionType` → bitmask map; pure predicate |
| [`types.ts`](../../../src/core/services/assignments/types.ts)                      | `AssignmentsEngineDeps`, `ResolvedAssignment`, `AssignmentMutationResult`, `BulkAssignmentResult` | Type definitions |
| [`index.ts`](../../../src/core/services/assignments/index.ts)                      | barrel                                 | Re-exports |

---

## Designing on top of `AssignmentsEngine`

- **Settings UI binding pickers** → `assign` (single slot) or
  `bulkAssign` (the whole panel as a transaction). Pipe
  `error.field` into your form-error state — capability
  mismatches show as the same kind of error as missing-profile.
- **Filtering profiles in pickers** → `meetsRequirements` is a
  pure predicate; use it on the client for "profiles eligible
  for OCR" lists without hitting storage.
- **SSR / server endpoints that need to dispatch on behalf of
  the user** → `resolveForAction` (or `tryResolveForAction`
  when an unset slot should render an empty state).
- **Custom cascade flows** (admin tools, bulk-delete operations)
  → call `cascadeProfileDelete` manually before each
  `storage.profiles.delete`. Or better: route through
  `ProfilesEngine.delete` and inherit the cascade automatically.

When you find yourself reaching past the engine into
`storage.assignments` directly, ask whether the rule you'd be
bypassing belongs in the engine instead.
