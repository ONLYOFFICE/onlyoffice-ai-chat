# @onlyoffice/ai-chat

Headless AI chat widget library for React with 16 built-in providers, MCP tool support, 41 locales, 7 themes, and pluggable adapters.

## Features

- **16 AI Providers** — Anthropic, OpenAI, Google GenAI, Mistral, Ollama, LM Studio, Groq, DeepSeek, xAI, OpenRouter, Together, StabilityAI, Zhipu, GPT4All, OpenAI-compatible, ONLYOFFICE
- **MCP Tools** — Host tools, web search (Exa API), custom MCP servers (HTTP + STDIO)
- **Adapter Pattern** — Pluggable storage, settings, and platform adapters
- **41 Locales** — Full i18n with RTL support
- **7 Themes** — Light, dark, white, gray, classic-light, night, contrast-dark + custom themes
- **Component Overrides** — Replace any built-in UI component
- **Imperative API** — Programmatic control via ref
- **Events & Middleware** — Intercept messages, tool calls, errors at 6 pipeline points
- **Headless Mode** — Use services, stores, and providers without the widget UI

## Installation

```bash
npm install @onlyoffice/ai-chat
```

**Peer dependencies:**

```bash
npm install react react-dom
```

## Quick Start

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";
import "@onlyoffice/ai-chat/styles";

function App() {
  return (
    <AIChatWidget
      storage={myStorageAdapter}
      settings={mySettingsAdapter}
      platform={myPlatformAdapter}
      storeKeys={{
        defaultProfile: "default-profile",
        chatProfile: "chat-profile",
        summarizationProfile: "summarization-profile",
        translationProfile: "translation-profile",
        textAnalysisProfile: "text-analysis-profile",
        imageGenerationProfile: "image-generation-profile",
        ocrProfile: "ocr-profile",
        visionProfile: "vision-profile",
        deepMode: "deep-mode",
        mcpServers: "mcp-servers",
        disabledTools: "disabled-tools",
      }}
      locale="en"
      theme="theme-light"
    />
  );
}
```

The three adapters (`storage`, `settings`, `platform`) are required. See [Adapters](docs/adapters.md) for implementation guides.

## Configuration

### Store Keys

The `storeKeys` prop maps logical setting names to actual storage key strings. Your `SettingsAdapter` reads/writes values by these keys.

### Callbacks

```tsx
<AIChatWidget
  callbacks={{
    onMessageSent: (data) => analytics.track("message", data),
    onStreamEnd: (data) => console.log("Response complete", data),
    onError: (data) => errorReporter.capture(data.error),
    onThreadCreated: (data) => console.log("New thread:", data.threadId),
    onProfileChanged: (data) => console.log("Profile:", data.profileId),
  }}
  // ...other props
/>
```

See [Events & Middleware](docs/events-and-middleware.md) for the full event catalog.

### Middleware

Intercept and transform the message flow at 6 points:

```tsx
<AIChatWidget
  middleware={[
    {
      beforeSend: async (ctx) => {
        if (containsBadWords(ctx.text)) {
          return { action: "block", reason: "Content policy violation" };
        }
        return { action: "continue" };
      },
    },
    {
      onError: (ctx) => {
        errorReporter.capture(ctx.error);
        return { action: "default" };
      },
    },
  ]}
  // ...other props
/>
```

See [Events & Middleware](docs/events-and-middleware.md) for all middleware hooks.

## Adapters

Three pluggable adapters let you integrate with any host application:

| Adapter | Purpose | Example |
|---------|---------|---------|
| `StorageAdapter` | Persist threads, messages, profiles, prompts | IndexedDB, SQLite, REST API |
| `SettingsAdapter` | Key-value settings (API keys, preferences) | localStorage, AsyncStorage |
| `PlatformAdapter` | Host integration (files, processes, themes) | Desktop editor, browser-only |

```ts
// Minimal SettingsAdapter
const settings: SettingsAdapter = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
};
```

See [Adapters](docs/adapters.md) for full implementation examples.

## Providers

16 built-in AI providers, plus runtime registration of custom ones:

```ts
import { registerProvider } from "@onlyoffice/ai-chat/providers";

registerProvider("my-custom", new MyCustomProvider());
```

| Provider | Type | SDK |
|----------|------|-----|
| Anthropic | `anthropic` | `@anthropic-ai/sdk` |
| OpenAI | `openai` | `openai` |
| Google GenAI | `genai` | `@google/genai` |
| Mistral | `mistral` | `@mistralai/mistralai` |
| Ollama | `ollama` | `openai` (compatible) |
| LM Studio | `lm-studio` | `openai` (compatible) |
| Groq | `groq` | `openai` (compatible) |
| DeepSeek | `deepseek` | `openai` (compatible) |
| xAI | `xai` | `openai` (compatible) |
| OpenRouter | `openrouter` | `openai` (compatible) |
| Together | `together` | `openai` (compatible) |
| StabilityAI | `stabilityai` | Custom |
| Zhipu | `zhipu` | `openai` (compatible) |
| GPT4All | `gpt4all` | `openai` (compatible) |
| OpenAI Compatible | `openaicompatible` | `openai` |
| ONLYOFFICE | `onlyoffice` | `openai` (compatible) |

See [Providers](docs/providers.md) for custom provider tutorial.

## Tools & MCP

Three tool sources unified by the `Servers` class:

- **Host Tools** — Tools exposed by the host application (e.g. editor commands)
- **Web Search** — Exa API integration for real-time web search
- **Custom MCP Servers** — JSON-RPC 2.0 over HTTP or STDIO

```tsx
const editorTools: HostToolGroup = {
  id: "editor",
  name: "Editor Tools",
  tools: [{
    name: "insert_text",
    description: "Insert text at cursor position",
    inputSchema: { type: "object", properties: { text: { type: "string" } } },
    handler: async (args) => editor.insertText(args.text),
  }],
};

<AIChatWidget hostToolGroups={[editorTools]} ...props />
```

See [Tools & MCP](docs/tools-and-mcp.md) for full configuration.

## Theming

7 built-in themes + custom themes via CSS variables:

```tsx
<AIChatWidget theme="theme-dark" ...props />
```

```tsx
// Custom theme overrides
<AIChatWidget
  customTheme={{ "--ai-chat-bg": "#1a1a2e", "--ai-chat-text": "#eee" }}
  ...props
/>
```

See [Theming](docs/theming.md) for CSS variables reference.

## Internationalization

41 bundled locales with lazy loading:

```tsx
<AIChatWidget locale="ru" ...props />
```

Supported: `ar-SA`, `be`, `bg`, `ca`, `cs-CZ`, `da`, `de`, `el`, `en`, `es`, `fi`, `fr`, `gl`, `he`, `hr`, `hu`, `hy`, `id`, `it`, `ja-JP`, `ko`, `lv`, `nl`, `no`, `pl`, `pt-BR`, `pt-PT`, `ro`, `ru`, `sk-SK`, `sl`, `sq-AL`, `sr-Cyrl-RS`, `sr-Latn-RS`, `sv`, `tr`, `uk`, `ur`, `vi`, `zh-CN`, `zh-TW`

See [I18n](docs/i18n.md) for custom translations.

## Component Overrides

Replace any built-in UI component:

```tsx
<AIChatWidget
  components={{ Button: MyButton, Input: MyInput }}
  ...props
/>
```

18 overridable slots: Button, IconButton, Input, Checkbox, RadioButton, ToggleButton, ComboBox, DialogContent, DialogOverlay, DialogFooter, DropdownMenu, DropDownItem, Tabs, TooltipContent, TooltipIconButton, Link, Loader, FieldContainer.

See [Component Overrides](docs/component-overrides.md).

## Imperative API

Control the widget programmatically via ref:

```tsx
const chatRef = useRef<AIChatWidgetRef>(null);

chatRef.current?.sendMessage("Summarize this document");
chatRef.current?.stopStreaming();
chatRef.current?.openSettings();

<AIChatWidget ref={chatRef} ...props />
```

Methods: `sendMessage`, `stopStreaming`, `isStreaming`, `switchThread`, `createThread`, `deleteThread`, `renameThread`, `clearHistory`, `downloadThread`, `getThreads`, `getCurrentThreadId`, `openChat`, `openSettings`, `openHistory`, `getCurrentPage`, `getProfiles`, `setChatProfile`, `getCurrentProfile`, `approveToolCall`, `denyToolCall`.

See [Imperative API](docs/imperative-api.md).

## Headless Mode

Use the library's services, stores, and providers without the widget UI:

```ts
import { Provider } from "@onlyoffice/ai-chat/providers";
import { Servers } from "@onlyoffice/ai-chat/tools";
import { ChatEventBus, CallbacksManager } from "@onlyoffice/ai-chat/events";
import { MiddlewareRunner } from "@onlyoffice/ai-chat/middleware";
import { createStores } from "@onlyoffice/ai-chat/store";
import type { AppContext } from "@onlyoffice/ai-chat";

const ctx: AppContext = {
  settings, storage, platform,
  provider: new Provider(),
  servers: new Servers(settings, platform, new ChatEventBus()),
  eventBus: new ChatEventBus(),
  callbacksManager: new CallbacksManager(),
  middlewareRunner: new MiddlewareRunner([]),
};

const stores = createStores({ keys: myStoreKeys, ctx });
// Use stores.chatEngine, stores.useMessageStore, etc.
```

See [Headless Usage](docs/headless-usage.md).

## Subpath Imports

Import only what you need for better tree-shaking:

```ts
import { AIChatWidget } from "@onlyoffice/ai-chat";
import { Provider } from "@onlyoffice/ai-chat/providers";
import { createStores } from "@onlyoffice/ai-chat/store";
import { ChatEngine } from "@onlyoffice/ai-chat/services";
import type { Thread, Profile } from "@onlyoffice/ai-chat/types";
import { isDjVu, isPdf } from "@onlyoffice/ai-chat/utils";
```

Available subpaths: `/providers`, `/services`, `/store`, `/storage`, `/settings`, `/platform`, `/tools`, `/events`, `/middleware`, `/i18n`, `/theme`, `/components`, `/images`, `/pages`, `/hooks`, `/types`, `/utils`.

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Step-by-step setup with Vite, Next.js |
| [Adapters](docs/adapters.md) | StorageAdapter, SettingsAdapter, PlatformAdapter implementation |
| [Providers](docs/providers.md) | Built-in providers, custom provider tutorial |
| [Tools & MCP](docs/tools-and-mcp.md) | Host tools, web search, MCP servers |
| [Events & Middleware](docs/events-and-middleware.md) | Event catalog, middleware pipeline |
| [Theming](docs/theming.md) | CSS variables, custom themes |
| [I18n](docs/i18n.md) | Locales, custom translations |
| [Component Overrides](docs/component-overrides.md) | Replace built-in UI components |
| [Imperative API](docs/imperative-api.md) | Ref methods reference |
| [Pages](docs/pages.md) | Standalone page components |
| [Headless Usage](docs/headless-usage.md) | Manual AppContext, custom UI |
| [Architecture](docs/architecture.md) | Data flow, dependency injection |

## License

MIT
