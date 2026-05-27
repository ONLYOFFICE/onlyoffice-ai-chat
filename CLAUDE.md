# CLAUDE.md

## Project

**@onlyoffice/ai-chat** — headless AI chat widget library with 16 built-in providers, MCP tool support, and pluggable adapters.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build library (Vite → `dist/`) |
| `npm test` | Watch-mode tests (Vitest) |
| `npm run test:run` | Single-run tests |
| `npm run test:coverage` | Coverage report (v8) |
| `npm run lint` | ESLint check (`src/`) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier auto-format |
| `npm run format:check` | Prettier check only |
| `npm run typecheck` | `tsc --noEmit` |

## Tech Stack

React 18/19, TypeScript 5.8, Vite 7, Zustand 5, Radix UI, TailwindCSS 4, Framer Motion, CodeMirror 6, i18next (41 locales), Vitest.

## Project Structure

```
src/
  core/                      Pure business logic — no React, no browser-only APIs
    providers/               16 built-in AI providers + AbstractBaseProvider + registry
    services/                Engine classes (orchestration layer, named *Engine)
    storage/                 StorageAdapter contract + eleven domain sub-storages
    actions/                 One-shot actions (chat, summarization, translation, OCR, …)
    middleware/              ChatMiddleware pipeline + MiddlewareRunner
    capabilities.ts          Capability bitmask helpers
    tools-adapter.ts         Bridge between core and UI tool sources
    types.ts                 Core domain types (Thread, Profile, Model, Prompt, …)
  ui/                        React layer
    components/              UI components (buttons, dialogs, markdown, layouts)
    pages/                   Page-level containers (seven exported pages)
    hooks/                   Custom hooks (useMessages, useProfiles, useServers, …)
    store/                   Zustand stores (threads, profiles, prompts, servers, …)
    providers/               React providers (Api, Events, Tools, Platform, Theme, …)
    tools/                   Tool runtime — Servers class, HostToolSource, CustomServers
    styles/                  Tailwind CSS + theme files
  shared/                    Type-only primitives — no deps on core/ui or frameworks
                             (provider/model/capability/action types, errors, abort, logger)
  translations/              41 i18n JSON locales
  assets/                    Icons, images
  tests/                     Cross-cutting test helpers / fixtures
  AIChatWidget.tsx           Main React component
  widget-config.tsx          Public widget configuration plumbing
  app-context.ts             Top-level React context
  capabilities.ts            Capability bitmask helpers (re-export surface)
  index.ts                   Library entry point (public re-exports)
```

## Architecture

- **Adapter pattern**: `StorageAdapter`, `SettingsAdapter`, `PlatformAdapter` — all injected via React context, no direct implementation imports.
- **Provider system**: `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>` base class. 16 concrete implementations + dynamic registry (`registerProvider` / `unregisterProvider`). Streaming via `AsyncGenerator`.
- **Services layer (engines)**: Zero UI dependencies. Nine engine classes orchestrate domain logic — `AIEngine` (streaming chat, one-shot actions, custom prompts), `ProfilesEngine`, `AssignmentsEngine`, `ThreadsEngine`, `ToolsEngine`, `PromptsEngine`, `WebSearchEngine`, `PreferencesEngine`, `AttachmentsEngine`.
- **Tool system**: Two sources unified by the `Servers` class — `HostToolSource` (host-provided tools) and `CustomServers` (MCP via JSON-RPC 2.0 over HTTP/STDIO). Web search is its own engine (`WebSearchEngine`, Exa API).
- **Capabilities bitmask**: `CapabilitiesUI` (Chat, Image, Embeddings, Audio, Vision, Tools) filters profiles per `ActionType` (Summarization, Translation, OCR, …).
- **Zustand stores** with global holders set synchronously during render (not in `useEffect`).

## Code Style

- **Prettier**: double quotes, semicolons, trailing commas (ES5), 2-space indent, 80-char width, LF.
- **ESLint**: `eqeqeq` always, `prefer-const` error, `no-debugger` error, `no-console` warn (use `src/shared/logger.ts` instead of `console.*`).
- **TypeScript**: strict mode, `verbatimModuleSyntax`, `noUnusedLocals` / `noUnusedParameters`.
- Use `===` / `!==`, never `==` / `!=`.
- No `any` — use `unknown` with type assertions (`as unknown as T`) when needed.
- No unused variables — remove or use `void expr` for intentionally consumed values.
- React hooks must have complete dependency arrays.
