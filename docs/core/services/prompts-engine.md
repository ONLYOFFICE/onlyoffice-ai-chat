# `PromptsEngine`

> Source: [`src/core/services/prompts/`](../../../src/core/services/prompts)

`PromptsEngine` is the lifecycle orchestrator for saved prompt
templates and their folders. It wraps `storage.prompts` +
`storage.promptFolders` with the rules that plain CRUD can't
express:

- **Folder name uniqueness** (case-insensitive, global — no
  nesting allowed in the data model).
- **Prompt name uniqueness within folder scope** — the same
  name can exist in multiple folders, but not twice in the same
  folder. Root level (`folderId === null`/`undefined`) counts
  as one scope.
- **Folder-reference integrity** — `prompt.folderId` must point
  at an existing folder (or be `null`/`undefined` for root). A
  dangling reference is rejected at write time.
- **Atomic move** between folders with a re-validation of the
  target scope.
- **Versioned import / export** — `PromptBundle` round-trips
  the full library, with `merge` and `replace` modes.

`core/` runs on both server and client; this engine has no DOM /
browser APIs anywhere.

---

## Construction

```ts
import { PromptsEngine } from "@/core/services";

const engine = new PromptsEngine({ storage });
```

```ts
type PromptsEngineDeps = {
  storage: StorageAdapter;
};
```

The engine is stateless across calls. Share one instance per
`AppContext`.

---

## Methods at a glance

| Method                                    | Returns                              | Persists?                           | Validates? |
| ----------------------------------------- | ------------------------------------ | ----------------------------------- | ---------- |
| [`create`](#create)                       | `PromptMutationResult`               | `prompts.create`                    | ✅ name + folder ref |
| [`update`](#update)                       | `PromptMutationResult`               | `prompts.update`                    | ✅ name + folder ref (when changing) |
| [`move`](#move)                           | `PromptMutationResult`               | `prompts.update` (delegates to `update`) | ✅ folder ref + scope |
| [`delete`](#delete)                       | `void`                               | `prompts.delete` (no-op if missing) | ❌         |
| [`list`](#list)                           | `Prompt[]`                           | ❌                                  | ❌         |
| [`createFolder`](#createfolder)           | `FolderMutationResult`               | `promptFolders.create`              | ✅ name uniqueness |
| [`renameFolder`](#renamefolder)           | `FolderMutationResult`               | `promptFolders.update`              | ✅ name uniqueness |
| [`deleteFolder`](#deletefolder)           | `void`                               | `promptFolders.delete` (cascade)    | ❌         |
| [`listFolders`](#listfolders)             | `PromptFolder[]`                     | ❌                                  | ❌         |
| [`export`](#export)                       | `PromptBundle`                       | ❌                                  | ❌         |
| [`importBundle`](#importbundle)           | `ImportResult`                       | replace: full rewrite; merge: per-entry upsert | ✅ version + bundle refs |

---

## Validation

> Source: [`validation.ts`](../../../src/core/services/prompts/validation.ts)

Three pure predicates, all exported:

```ts
validateFolderName(existing: PromptFolder[], name: string, excludeId?: string): TErrorData | null;
validatePromptName(existing: Prompt[], name: string, folderId: string | null | undefined, excludeId?: string): TErrorData | null;
validateFolderReference(existing: PromptFolder[], folderId: string | null | undefined): TErrorData | null;
```

| Check                              | Failure shape |
| ---------------------------------- | ------------- |
| Empty folder / prompt name         | `{ field: "name", message: "Name is required" }` |
| Folder name collision              | `{ field: "name", message: "Folder name already exists" }` |
| Prompt name collision in scope     | `{ field: "name", message: "Prompt name already exists in this folder" }` |
| `folderId` references missing folder | `{ field: "name", message: "Folder not found: <id>" }` |

The predicates are pure (no storage access) — they take the full
existing list as input. UI code can wire them up for live
client-side form validation without going through the engine.

---

## Prompts

### `create`

```ts
async create(input: CreatePromptInput): Promise<PromptMutationResult>;

type CreatePromptInput = {
  name: string;
  text: string;
  folderId?: string | null;
};
```

1. Read folders, validate `folderId` reference.
2. Read all prompts, validate name uniqueness in `folderId` scope.
3. Generate `id` (`crypto.randomUUID()`), set
   `createdAt = updatedAt = Date.now()`.
4. `storage.prompts.create(prompt)`.

Returns `{ success: true, prompt }` or
`{ success: false, error }`.

### `update`

```ts
async update(
  id: string,
  updates: { name?: string; text?: string; folderId?: string | null }
): Promise<PromptMutationResult>;
```

Partial patch. Re-validates only the fields that are changing:

- If `folderId` is in `updates` and is non-null, validate that
  the folder exists.
- If `name` is in `updates`, validate uniqueness in the **target**
  scope (the `folderId` after the update, not before).

Returns the updated prompt on success — re-reads it after the
write to pick up the storage's `updatedAt` bump.

### `move`

```ts
async move(id: string, folderId: string | null): Promise<PromptMutationResult>;
```

Sugar for `update(id, { folderId })`. The target-scope name
re-validation is the meaningful behaviour: moving a prompt named
"Summarize" into a folder that already has a "Summarize" fails
with the same error as the equivalent `update` call.

### `delete`

```ts
async delete(id: string): Promise<void>;
```

`storage.prompts.delete` is idempotent.

### `list`

```ts
async list(folderId?: string | null): Promise<Prompt[]>;
```

- `list()` — every prompt, sorted by `createdAt` desc (per
  `PromptsStorage.readAll`).
- `list(null)` — root-level prompts only.
- `list("<folder-id>")` — prompts in that folder.

---

## Folders

### `createFolder`

```ts
async createFolder(name: string): Promise<FolderMutationResult>;
```

1. Read all folders, validate name uniqueness.
2. Generate `id`, set `createdAt = updatedAt = Date.now()`.
3. `storage.promptFolders.create(folder)`.

### `renameFolder`

```ts
async renameFolder(id: string, name: string): Promise<FolderMutationResult>;
```

1. Read folders. Reject if `id` is missing.
2. Validate the new name with `excludeId = id` so the folder's
   own name doesn't collide with itself.
3. `storage.promptFolders.update(id, name)`. Re-read for the
   `updatedAt` bump and return.

### `deleteFolder`

```ts
async deleteFolder(id: string): Promise<void>;
```

`storage.promptFolders.delete` cascades to prompts inside the
folder per the storage contract — see
[`PromptFoldersStorage`](../storage/storage.md#promptfoldersstorage).

### `listFolders`

```ts
async listFolders(): Promise<PromptFolder[]>;
```

Direct passthrough — sorted by `createdAt` desc.

---

## Import / export

### `PromptBundle`

```ts
type PromptBundle = {
  version: 1;
  folders: PromptFolder[];
  prompts: Prompt[];
};
```

Stable, self-contained wire format — `version` lets the import
path migrate older shapes if the schema ever changes (today only
`1` is supported).

### `export`

```ts
async export(): Promise<PromptBundle>;
```

Reads both stores in parallel and returns a `version: 1` bundle.
No filtering — exports the full library.

### `importBundle`

```ts
async importBundle(
  bundle: PromptBundle,
  options?: { mode?: ImportMode }
): Promise<ImportResult>;

type ImportMode = "replace" | "merge";
```

```ts
type ImportResult =
  | { success: true; imported: { folders: number; prompts: number } }
  | { success: false; errors: ImportError[] };

type ImportError = {
  kind: "folder" | "prompt";
  ref: string;
  error: TErrorData;
};
```

Both modes start by validating the bundle:

- **Version check** — only `version: 1` accepted.
- **Reference check** — every prompt's non-null `folderId` must
  resolve against a folder also present in the bundle. Dangling
  references produce one `ImportError` per offender; the import
  is rejected as a whole.

Then either:

- **`replace` (default)** — read the existing folders + prompts,
  delete them all, then `createMany` the bundle's folders and
  prompts. Atomic in spirit; the storage adapter is expected
  to back the writes with a transaction. Use this when the
  bundle is a full backup.
- **`merge`** — for each folder/prompt in the bundle: if `id`
  already exists, `update`; otherwise `create`. Uses
  `createMany` for the new entries to keep the round-trip count
  down. Existing data outside the bundle is preserved.

`merge` mode skips the engine's name-uniqueness check —
the bundle was exported from a valid state, so the assumption
is the names already pass. If you want to validate name rules,
import individual entries through `create` / `createFolder`
instead.

---

## Persistence semantics — at a glance

| Trigger                                  | Storage write                                                |
| ---------------------------------------- | ------------------------------------------------------------ |
| `create`, success                        | `prompts.create(prompt)`                                     |
| `create`, failure                        | *no write*                                                   |
| `update`, success                        | `prompts.update(id, updates)`                                |
| `update`, failure                        | *no write*                                                   |
| `move`, success                          | `prompts.update(id, { folderId })`                           |
| `delete`                                 | `prompts.delete(id)` (no-op if missing)                      |
| `createFolder`, success                  | `promptFolders.create(folder)`                               |
| `createFolder`, failure                  | *no write*                                                   |
| `renameFolder`, success                  | `promptFolders.update(id, name)`                             |
| `renameFolder`, failure                  | *no write*                                                   |
| `deleteFolder`                           | `promptFolders.delete(id)` (cascades to prompts)             |
| `export`                                 | *no write* (read-only)                                       |
| `importBundle`, validation failure       | *no write*                                                   |
| `importBundle({ mode: "replace" })`      | `prompts.delete` × N + `promptFolders.delete` × M, then `promptFolders.createMany` + `prompts.createMany` |
| `importBundle({ mode: "merge" })`        | `promptFolders.createMany`/`update` per entry, then `prompts.createMany`/`update` per entry |

---

## Internal helpers

| File                                                                                  | Exports                                | Role |
| ------------------------------------------------------------------------------------- | -------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/prompts/engine.ts)                            | `PromptsEngine`                        | Public class |
| [`validation.ts`](../../../src/core/services/prompts/validation.ts)                    | `validateFolderName`, `validatePromptName`, `validateFolderReference` | Pure predicates — also exported from the engine module |
| [`types.ts`](../../../src/core/services/prompts/types.ts)                              | `PromptsEngineDeps`, `CreatePromptInput`, `PromptMutationResult`, `FolderMutationResult`, `PromptBundle`, `ImportMode`, `ImportResult`, `ImportError` | Type definitions |
| [`index.ts`](../../../src/core/services/prompts/index.ts)                              | barrel                                 | Re-exports |

---

## Designing on top of `PromptsEngine`

- **Prompt-library settings UI** — `create` / `update` / `move`
  / `delete` for prompts, `createFolder` / `renameFolder` /
  `deleteFolder` for folders. Pipe `error.field` into form
  state; the validation predicates are exported for live
  client-side validation.
- **Drag-and-drop "move prompt to folder" UX** — `move`. The
  scope re-validation catches the "duplicate name in target
  folder" edge case server-side rather than failing silently.
- **"Export library" / "Import library" menu items** — `export`
  + `importBundle` with the JSON-serialized bundle as wire
  format. Default `replace` mode; offer a `merge` toggle for
  power users who want to layer two libraries.
- **Server-side bulk-import endpoint** — `importBundle({ mode:
  "merge" })`. The bundle is pure data; no DOM is touched
  anywhere in the engine.
- **Multi-tenant prompt sharing** — export per-team libraries
  to `PromptBundle`, import on the user's storage. Bundle
  versioning (`version: 1`) lets the schema evolve without
  breaking imports from older clients.

When you find yourself reaching past the engine into
`storage.prompts` or `storage.promptFolders` directly, ask
whether the rule you'd be bypassing belongs in the engine
instead — particularly the name-uniqueness checks and folder
reference integrity, which `PromptsStorage` does **not** enforce
on its own.
