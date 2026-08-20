# CLAUDE.md

## Project

**@onlyoffice/ai-chat** — headless AI chat widget library with built-in AI providers, MCP tool support, and pluggable adapters.

## Layout conventions

- `src/core/` — pure business logic: no React, no browser-only APIs.
- `src/core/services/` — engine classes (orchestration layer), named `*Engine`.
- `src/shared/` — type-only primitives: no dependencies on `core/`, `ui/`, or any framework.

## Architecture

- **Adapter pattern**: `StorageAdapter`, `SettingsAdapter`, `PlatformAdapter` are injected via React context — never import an implementation directly.
- **Services layer (engines)**: zero UI dependencies.
- **Capabilities bitmask**: `CapabilitiesUI` filters profiles per `ActionType`.
- **Zustand stores**: global holders are set synchronously during render, *not* in `useEffect`.

## Packaging contract

- New runtime imports go in `peerDependencies`, **not** `dependencies` — only `lodash.clonedeep` is a real dependency. Vite externalizes both, so a misplaced `npm i --save` builds fine and silently forces the package on every consumer.
- Provider SDKs and any optional UI dependency also need an entry in `peerDependenciesMeta` marking them `optional: true`.
- The widget must never emit global CSS. Everything under Tailwind's `@layer base` is rewritten to scope under `.aui-root` by `scripts/scope-preflight.mjs` at build time — don't add selectors that assume they own the host page.
- To hand a build to a consuming app without a version bump in git history: `npm run pack:pre -- --preid <label> <n>`.

## Code Style

- Use `src/shared/logger.ts` instead of `console.*`.
- No `any` — use `unknown` with type assertions (`as unknown as T`) when needed.
- For intentionally consumed values, use `void expr` rather than an unused variable.
