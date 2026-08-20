---
name: release
description: Cut a version of this library — version bump, CHANGELOG entry in the established house format, verification, and building a prerelease tarball for a consuming app. Load when asked to release, bump the version, write a CHANGELOG entry, or pack a build for handoff.
---

# Releasing

## CHANGELOG format

`CHANGELOG.md` is newest-first with no dates and no links:

```markdown
## 0.5.52

### Changed

- One sentence on what changed, then the reason it changed.

### Fixed

- What was broken and what it does now.
```

Observed section vocabulary, by frequency: **`### Changed`** (47),
**`### Fixed`** (45), **`### Added`** (24), and rarely `### Removed` /
`### Breaking`. Use those four; don't invent new headings.

House style for entries:

- **Written in English, always** — regardless of the language of the
  conversation that produced the change.
- Short bullets that explain the *why*, not just the *what*. The 0.5.52
  entry is the model: it says capability icons are now OpenRouter-only
  **and** that elsewhere the mask is an inferred blanket default, so the
  icons said nothing reliable.
- A tiny fenced snippet only when it clarifies a data shape:
  ```ts
  // supported_parameters: ["temperature", "tools"] → Chat | Tools
  ```
- No "bump version", no restating the diff, no commit hashes.

## Version bump

Edit `version` in `package.json` and keep **`package-lock.json` in sync**
(both its top-level `version` and `packages[""].version`).

Two shapes are valid — pick by whether the bump stands alone:

- A dedicated release commit touching only `CHANGELOG.md` and
  `package.json`: `chore: release 0.5.50`
- The bump folded into the change itself, with the version in parentheses
  at the end of the prefixed subject:
  `feat: drop the system-tools catalog cache - always enumerate live (0.5.47)`

Never write a commit whose subject is *about* the bump ("Bump version to
X") — the version is a marker on a real change, not a change itself. See
the `git-workflow` skill for the prefix set.

The repo has **no git tags**; don't create one unless asked.

## Verify before cutting

```
npm run typecheck && npm run lint && npm run test:run && npm run build
```

`prebuild` regenerates the i18n, theme, and icon types, so a dirty
working tree after `npm run build` means a generated file was stale and
is now correct — commit it.

## Prerelease tarball for a consuming app

To hand a build to another app without leaving a version bump in git
history:

```
npm run pack:pre -- --preid <label> <n>     # <current>-<label>.<n>
npm run pack:docs      -- <n>               # preid "docs"
npm run pack:docspace  -- <n>               # preid "docspace"
```

`scripts/pack-pre.mjs` builds, sets a temporary prerelease version, runs
`npm pack`, then **restores the exact pre-bump bytes** of `package.json`
and `package-lock.json` — not via `git checkout`, so unrelated
uncommitted edits to those files survive.

Delete the superseded `*.tgz` from the repo root when a new one replaces
it; they are not gitignored.

## Publishing

`files` limits the package to `dist`, `README.md`, `LICENSE`,
`CHANGELOG.md`. Publishing to npm is not scripted here — don't run
`npm publish` unless explicitly asked.
