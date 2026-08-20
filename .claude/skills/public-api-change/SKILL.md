---
name: public-api-change
description: Add, rename, or remove anything in the library's exported surface. Four places must agree — the subpath barrel, the package.json exports map, the vite entry list, and docs/ — and a mismatch fails at the consumer, not at your compiler. Load before touching src/index.ts, any subpath index.ts, or the exports/entries config.
---

# Changing the public API

Nothing verifies this surface automatically. There is **no CI** (no
`.github/workflows/`), no pre-commit hook, and since the sample apps were
removed there is no integration consumer either — so a broken export
first shows up in someone else's build.

## The four places that must agree

| Place | What lives there |
| --- | --- |
| `src/index.ts` | 560 lines of re-exports grouped by banner comments (AppContext, Capabilities, Widget, Config, …) — the flat surface for `import … from "@onlyoffice/ai-chat"` |
| the subpath barrel | e.g. `src/core/services/index.ts` — what `…/services` resolves to |
| `exports` in `package.json` | 18 keys mapping public specifiers to `dist/` paths |
| `entries` in `vite.config.ts` | 15 build entry points |
| `docs/` + the relevant `src/**/README.md` | the documented surface |

**A new subpath needs the barrel, a vite entry, an `exports` key, and
docs — all of them.** The failure mode worth remembering: adding only the
`exports` key yields a public specifier that resolves to a file the build
never emitted. Your typecheck passes, your build passes, and the consumer
gets an unresolvable import.

## Traps

- **`./providers` vs `./providers/ApiProvider`.** The first maps to
  `dist/core/providers` (AI providers), the second to
  `dist/ui/providers/ApiProvider` (a React provider). Two unrelated
  subtrees under one prefix — don't "tidy" either into the other; the
  rename is a breaking change.
- **`tsconfig.build.json` drives `vite-plugin-dts`.** A type that isn't
  reachable from an entry produces no `.d.ts`, so consumers get a working
  import with no types.
- **`eslint.config.mjs` pins `tsconfigRootDir`** deliberately; leave it
  pinned.
- **New runtime imports go in `peerDependencies`**, optional ones also in
  `peerDependenciesMeta` — see `CLAUDE.md`.
- **A removed or renamed export is a breaking change.** Record it in the
  CHANGELOG under `### Changed` or `### Removed` (see the `release`
  skill).

## Before committing

```
npm run typecheck && npm run lint && npm run test:run && npm run build
```

Then inspect `dist/` for the paths your `exports` keys claim: every
specifier you added or touched must resolve to a file that actually
exists.
