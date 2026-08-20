---
name: git-workflow
description: This repository's git etiquette — commit subject style (which changed in August 2026), branch naming, how version markers and external bug numbers appear in subjects, and the self-hosted Gitea merge-request flow. Load before writing a commit message or creating a branch.
---

# Git workflow

Remote is **self-hosted Gitea**, not GitHub:
`git@git.onlyoffice.com:ONLYOFFICE/onlyoffice-ai-chat.git`. The `gh` CLI
does not apply here. `master` is the only long-lived branch.

## Commit subjects

Use a **conventional prefix**, lowercase after the colon, then a plain
imperative summary. No trailing period.

```
feat: let sendCustom target a chosen profile instead of only the default
fix: don't let a failed thread rename abort the reply
chore: release 0.5.50
```

The prefixes in use, by frequency over the last 400 commits:

| Prefix | Uses | For |
| --- | --- | --- |
| `feat:` | 145 | new capability or public surface |
| `fix:` | 98 | bug fix — this is the bugfix prefix; **`bug:` has never been used** |
| `chore:` | 44 | releases, dependency and tooling upkeep |
| `style:` | 4 | formatting-only, no behaviour change |
| `refactor:` | 4 | restructuring with no behaviour change |
| `test:` | 3 | tests only |
| `docs:` | 2 | documentation only |
| `perf:` | 1 | performance |
| `build:` | 1 | build config |

Scopes (`feat(chat):`) are not used — the bare prefix only.

**A caveat when you read `git log`:** a run of about ten commits starting
2026-08-14 dropped the prefix and used a bare capitalized imperative
("Send plain-string content for text-only OpenAI messages"). That is
drift, not a second convention — add the prefix to new work, and leave
the old subjects alone.

Shape, measured across recent history: median subject length 53
characters, max 80, **zero** subjects end with a period.

## Version markers and bug numbers

- When a commit also bumps the version, the version goes in parentheses
  at the end of the subject, after the prefixed summary:
  `feat: drop the system-tools catalog cache - always enumerate live (0.5.47)`.
  Never write a subject *about* the bump ("Bump version to X") — the
  version is a marker on a real change. (The older examples of this form
  in the log predate the prefix, per the caveat above.)
- Fixes tracked in the external bug tracker cite the number the same way:
  `fix: serialize non-string tool results before resuming the chat (Bug 82862)`.
  Use the `(Bug NNNNN)` form when you have a number; omit it otherwise.

## Bodies

Most non-trivial commits carry a body. Use it for *why*, the same
standard as this codebase's inline comments — the constraint that forced
the change, the failure it prevents. Don't restate the diff.

Never add a `Co-Authored-By` trailer.

## Branches

Two prefixes are in use, plus the occasional bare topic name:

```
feature/suggestions          feature/web-search-reset-button
bugfix/dnd                   bugfix/ai-chat-error-reporting
desktop-plugin-issues        (bare topic name — less common)
```

Prefer `feature/<kebab-topic>` and `bugfix/<kebab-topic>`. Branch off
`master`.

## Merging

Work lands through Gitea merge requests. The generated merge commit looks
like:

```
Merge pull request 'fix: report failed hydration through onError instead of rejecting' (!11) from bugfix/ai-chat-error-reporting into master
```

`!N` is the MR number. Long-running branches are periodically caught up
with `Merge branch 'master' into <branch>` rather than rebased, so the
history is intentionally non-linear — don't rewrite it.

## Before committing

There is no CI and no pre-commit hook — nothing runs automatically:

```
npm run typecheck && npm run lint && npm run test:run
```

Commit or push only when asked.
