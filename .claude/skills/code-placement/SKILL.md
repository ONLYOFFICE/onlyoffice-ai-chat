---
name: code-placement
description: Decide where new code belongs in this repository — the core/ui/shared layer rules, which subsystem owns a given concern (provider vs action vs engine vs store vs hook), and which in-repo README documents each one. Load before creating a new file or moving code between layers.
---

# Where does this code go?

## The layer rule (violating it creates an import cycle or breaks SSR)

```
shared/  ←  core/  ←  ui/
```

1. **`src/shared/`** — bottom of the graph. Type-only primitives and tiny
   utilities. Imports nothing from `core/` or `ui/`, no framework.
2. **`src/core/`** — runs without React, on server and client alike. Never
   imports from `ui/`. No `window`, `document`, `localStorage`, or
   `IndexedDB` — all I/O goes through injected adapters.
3. **`src/ui/`** — React. Reaches `core/` only through engines and
   adapters; never pokes provider internals.

Two rules that are easy to break silently:

- **All host integration goes through an adapter** — `StorageAdapter`,
  `SettingsAdapter`, `PlatformAdapter`, `ToolsAdapter`. No ONLYOFFICE- or
  browser-specific call anywhere in `src/`.
- **Zustand global holders are set synchronously during render**, not in
  `useEffect` — stores must be able to read them on first render.

## Which subsystem owns it?

| The thing you're adding | Goes in | Read first |
| --- | --- | --- |
| Talking to a new AI vendor's API | `core/providers/<name>/` | `src/core/providers/README.md` + the `add-ai-provider` skill |
| A new *kind* of AI call (like summarize/OCR) | `core/actions/<name>/` with a sibling `prompt.ts` holding the baked-in system prompt (only `custom/` has none — its prompt is caller-supplied) | `src/core/actions/README.md` |
| Orchestration: persistence, validation, cascades around an action | an `*Engine` in `core/services/<domain>/` | `src/core/services/README.md` |
| A new persisted domain | a `*Storage` interface in `core/storage/`, added to `StorageAdapter` | `src/core/storage/README.md` |
| A hook into the chat flow | `core/middleware/` | `docs/core/middleware/README.md` |
| A shared type or pure helper | `src/shared/` | `src/shared/README.md` |
| Reusable UI primitive | `ui/components/<kebab-name>/` | the `code-style` skill |
| A screen | `ui/pages/<kebab-name>/` | `docs/ui/pages.md` |
| Client state | `ui/store/` (Zustand, created in `createStores()`) | `src/README.md` |
| React-facing data access | `ui/hooks/` | `docs/ui/hooks.md` |
| Tool/MCP runtime | `ui/tools/` | `docs/ui/tools.md` |

## Component folder shape

Every component is a folder, not a file. Across the 26 folders in
`ui/components/`, only two parts are near-universal:

```
ui/components/<name>/
  index.tsx              # 25 of 26 folders; named export at the bottom
  tests/                 # 26 of 26 — always colocated, never a mirror tree
```

The rest are added **only when needed**, not as scaffolding:
`sub-components/` (5 folders), `hooks/` (2 folders), a
`<Name>.utils.tsx` helper module (2 folders). Don't create empty ones.
The lone exception to the barrel rule is `assistant-ui/`, a set of
standalone modules with no `index.tsx`.

If the component is a primitive that hosts should be able to replace,
also register it in `ui/providers/ComponentsProvider/defaults.ts`, add it
to `ComponentOverrides`, and export its props type (see the `code-style`
skill).

## Actions vs engines — the distinction that gets confused

An **action** is stateless: profile + messages in, result out. It knows
nothing about threads, storage, or stores. An **engine** does the
bookkeeping around actions — profile resolution, persistence, capability
validation, cascade deletes. If your code needs `storage`, it's an engine.

## Outside `src/`

- **`scripts/`** — build-time codegen and packaging (`generate-*.mjs`,
  `copy-themes.mjs`, `scope-preflight.mjs`, `pack-pre.mjs`).
- **`docs/`** — consumer-facing documentation.

## Documentation layout

`docs/` is **consumer-facing** (how a host app uses and customizes the
library). The per-directory `README.md` files under `src/` are the
contributor-facing map. When you add a subsystem, update the relevant
`src/**/README.md` table; when you change the public surface, update
`docs/` and `src/index.ts`.
