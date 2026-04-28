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

React 18/19, TypeScript 5.8, Vite 7, Zustand 5, Radix UI, TailwindCSS 4, Framer Motion, CodeMirror 6, i18next (43 locales), Vitest.

## Project Structure

```
src/
  components/     UI components (buttons, dialogs, markdown, layouts)
  pages/          Page-level containers
  hooks/          Custom hooks (useProfiles, useServers, useMessages, …)
  store/          Zustand stores (threads, profiles, prompts, servers, …)
  providers/      AI provider implementations (16 built-in + custom registry)
  services/       Business logic (ChatEngine, ProfilesService, ThreadsService, …)
  platform/       Platform adapters (OnlyOffice, NoOp)
  settings/       Settings adapter (localStorage)
  storage/        Storage adapter (IndexedDB)
  tools/          Tool management (MCP servers, web search, host tools)
  locales/        i18n JSON translations
  lib/            Internal utilities (logger, images, …)
  styles/         Tailwind CSS + theme files
  assets/         Icons, images
  AIChatWidget.tsx  Main React component
  types.ts          Domain types (Thread, Profile, Model, Prompt, …)
  index.ts          Library entry point (public re-exports)
```

## Architecture

- **Adapter pattern**: `StorageAdapter`, `SettingsAdapter`, `PlatformAdapter` — all injected via React context, no direct implementation imports.
- **Provider system**: `AbstractBaseProvider<TOOL, MESSAGE, CLIENT>` base class. 16 concrete implementations + dynamic registry (`registerProvider` / `unregisterProvider`). Streaming via `AsyncGenerator`.
- **Services layer**: Zero UI dependencies. `ChatEngine` manages message flow, tool approval, streaming. `ProfilesService`, `ThreadsService`, `PromptsService`, `ServersService` handle domain logic.
- **Tool system**: Three sources unified by `Servers` class — `HostToolSource`, `WebSearch` (Exa API), `CustomServers` (MCP via JSON-RPC 2.0 over HTTP/STDIO).
- **Capabilities bitmask**: `CapabilitiesUI` (Chat, Image, Vision, Tools, …) filters profiles per `ActionType` (Summarization, Translation, OCR, …).
- **Zustand stores** with global holders set synchronously during render (not in `useEffect`).

## Code Style

- **Prettier**: double quotes, semicolons, trailing commas (ES5), 2-space indent, 80-char width, LF.
- **ESLint**: `eqeqeq` always, `prefer-const` error, `no-debugger` error, `no-console` warn (use `src/shared/logger.ts` instead of `console.*`).
- **TypeScript**: strict mode, `verbatimModuleSyntax`, `noUnusedLocals` / `noUnusedParameters`.
- Use `===` / `!==`, never `==` / `!=`.
- No `any` — use `unknown` with type assertions (`as unknown as T`) when needed.
- No unused variables — remove or use `void expr` for intentionally consumed values.
- React hooks must have complete dependency arrays.
