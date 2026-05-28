# @onlyoffice/ai-chat — Basic Sample

A standalone Vite + React application demonstrating how to embed the `@onlyoffice/ai-chat` widget as a full-page AI chat interface with persistent storage.

## Features

- **Full-featured AI chat** with 17 built-in providers (OpenAI, Anthropic, Google Gemini, Mistral, Ollama, DeepSeek, Groq, OpenRouter, Together, xAI, LM Studio, GPT4All, Zhipu, Stability AI, and OpenAI-compatible endpoints)
- **Profile management** — create, edit, and delete AI provider profiles with API keys and model selection
- **Chat history** — threaded conversations with search across all messages
- **Saved prompts** — reusable prompt templates organized in folders
- **MCP server support** — connect to Model Context Protocol servers over HTTP
- **Web search** — integrated web search via Exa API
- **Streaming responses** — real-time token-by-token output from AI models
- **Theming** — 7 built-in themes (light, dark, white, gray, classic-light, night, contrast-dark) with automatic system theme detection
- **Internationalization** — 43 locales with automatic browser language detection
- **Markdown rendering** — rich message display with syntax-highlighted code blocks
- **Persistent storage** — IndexedDB for data (threads, messages, profiles, prompts), localStorage for settings

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |

## Architecture

The `@onlyoffice/ai-chat` widget is wired up in [src/App.tsx](src/App.tsx) with three required adapters and two optional tool sources:

| Prop | Implementation | Purpose |
|------|---------------|---------|
| `storage` | IndexedDB ([src/adapters/storage.ts](src/adapters/storage.ts)) | Persistent storage for threads, messages, profiles, prompts, folders, assignments, preferences, MCP servers, tool preferences, and web-search config |
| `settings` | `localStorage` ([src/adapters/settings.ts](src/adapters/settings.ts)) | Key-value store for selected profiles, feature flags, and other small scalars |
| `platform` | Browser defaults ([src/adapters/platform.ts](src/adapters/platform.ts)) | Host environment capabilities (theme, locale, device pixel ratio, system-theme change events) |
| `storeKeys` | Plain object ([src/store-keys.ts](src/store-keys.ts)) | Maps logical setting names to namespaced `ai-chat.*` storage keys |
| `hostToolGroups` | In-browser stubs ([src/adapters/hostTools.ts](src/adapters/hostTools.ts)) | Demo host tools the model can call (`current_time`, `user_agent`, `random_number`) |
| `toolsAdapter` | Stub ([src/adapters/toolsAdapter.ts](src/adapters/toolsAdapter.ts)) | Pluggable server-side tool source — `getTools()` returns a `serverType → tools[]` grouping the engine resolves automatically (no UI approval round-trip) |

### StorageAdapter (IndexedDB)

The IndexedDB storage in [src/adapters/storage.ts](src/adapters/storage.ts) creates a database `ai-chat-sample` with 10 object stores:

- **threads** — chat sessions (key: `threadId`, indexed by `lastEditDate`)
- **messages** — individual messages (key: `id`, indexed by `threadId`)
- **profiles** — AI provider profiles (key: `id`)
- **prompts** — saved prompt templates (key: `id`, indexed by `folderId`)
- **promptFolders** — prompt folder grouping (key: `id`)
- **assignments** — per-`ActionType` profile bindings (key: `actionType`)
- **preferences** — scalar user preferences such as deep-mode (key: `key`)
- **mcpServers** — custom MCP server registrations (key: `name`)
- **toolPrefs** — disabled / auto-approved tool lists (key: `key`)
- **webSearch** — singleton web-search provider configuration (key: `key`)

The schema lives at `DB_VERSION = 2` and `onupgradeneeded` creates each store conditionally so the sample upgrades cleanly from older copies.

### SettingsAdapter (localStorage)

A thin wrapper around `localStorage.getItem/setItem/removeItem` in [src/adapters/settings.ts](src/adapters/settings.ts). All keys are namespaced with `ai-chat.*` prefix via the `StoreKeys` mapping in [src/store-keys.ts](src/store-keys.ts).

### PlatformAdapter (browser)

Minimal browser adapter in [src/adapters/platform.ts](src/adapters/platform.ts) with `null` sub-adapters for unavailable capabilities (file operations, process spawning, host tools, cloud integration). Includes system theme change detection via `matchMedia`.

### Host tools and ToolsAdapter

[src/adapters/hostTools.ts](src/adapters/hostTools.ts) registers a small playground of browser-side tools the LLM can call directly — two auto-allow (`current_time`, `user_agent`) and one that opts into the approval dialog (`random_number`). [src/adapters/toolsAdapter.ts](src/adapters/toolsAdapter.ts) is a stub server-style `ToolsAdapter` returning two demo groups (`demo-server-a`, `demo-server-b`) — swap the `callTool` body with real backend logic when you wire up your own tool registry.

## Customization

Refer to the main library documentation for advanced usage:

- [Adapters](../../docs/adapters.md) — full adapter interface reference
- [Providers](../../docs/providers.md) — adding custom AI providers
- [Theming](../../docs/theming.md) — custom themes and CSS tokens
- [i18n](../../docs/i18n.md) — custom translations and locale registration
- [Tools & MCP](../../docs/tools-and-mcp.md) — MCP servers and host tools
- [Component Overrides](../../docs/component-overrides.md) — custom UI slots
- [Headless Usage](../../docs/headless-usage.md) — using stores and services directly
