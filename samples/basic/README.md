# @onlyoffice/ai-chat — Basic Sample

A standalone Vite + React application demonstrating how to embed the `@onlyoffice/ai-chat` widget as a full-page AI chat interface with persistent storage.

## Features

- **Full-featured AI chat** with 16 built-in providers (OpenAI, Anthropic, Google Gemini, Mistral, Ollama, DeepSeek, Groq, OpenRouter, Together, xAI, LM Studio, GPT4All, Zhipu, Stability AI, and OpenAI-compatible endpoints)
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

The `@onlyoffice/ai-chat` widget requires three adapter implementations:

| Adapter | Implementation | Purpose |
|---------|---------------|---------|
| `SettingsAdapter` | `localStorage` | Key-value store for settings (selected profiles, feature flags, MCP server configs) |
| `StorageAdapter` | `IndexedDB` | Persistent storage for threads, messages, profiles, prompts, and prompt folders |
| `PlatformAdapter` | Browser defaults | Host environment capabilities (theme, locale, device info) |

### StorageAdapter (IndexedDB)

The IndexedDB storage in `src/adapters/storage.ts` creates a database `ai-chat-sample` with 5 object stores:

- **threads** — chat sessions (key: `threadId`, indexed by `lastEditDate`)
- **messages** — individual messages (key: `id`, indexed by `threadId`)
- **profiles** — AI provider profiles (key: `id`)
- **prompts** — saved prompt templates (key: `id`, indexed by `folderId`)
- **promptFolders** — prompt folder grouping (key: `id`)

### SettingsAdapter (localStorage)

A thin wrapper around `localStorage.getItem/setItem/removeItem` in `src/adapters/settings.ts`. All keys are namespaced with `ai-chat.*` prefix via the `StoreKeys` mapping.

### PlatformAdapter (browser)

Minimal browser adapter in `src/adapters/platform.ts` with null sub-adapters for unavailable capabilities (file operations, process spawning, host tools, cloud integration). Includes system theme change detection via `matchMedia`.

## Customization

Refer to the main library documentation for advanced usage:

- [Adapters](../../docs/adapters.md) — full adapter interface reference
- [Providers](../../docs/providers.md) — adding custom AI providers
- [Theming](../../docs/theming.md) — custom themes and CSS tokens
- [i18n](../../docs/i18n.md) — custom translations and locale registration
- [Tools & MCP](../../docs/tools-and-mcp.md) — MCP servers and host tools
- [Component Overrides](../../docs/component-overrides.md) — custom UI slots
- [Headless Usage](../../docs/headless-usage.md) — using stores and services directly
