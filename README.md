# @onlyoffice/ai-chat

Headless AI chat widget library for React with 17 built-in providers, MCP tool support, 41 locales, 7 themes, and pluggable adapters.

## Features

- **16 AI Providers** — Anthropic, OpenAI, Google GenAI, Mistral, Ollama, LM Studio, Groq, DeepSeek, xAI, OpenRouter, Together, StabilityAI, Zhipu, GPT4All, OpenAI-compatible, ONLYOFFICE AI
- **MCP Tools** — Host tools, web search (Exa API), custom MCP servers (HTTP + STDIO)
- **Adapter Pattern** — Pluggable storage, settings, and platform adapters
- **41 Locales** — Full i18n with RTL support
- **7 Themes** — Light, dark, white, gray, classic-light, night, contrast-dark + custom themes
- **Component Overrides** — Replace any built-in UI component
- **Imperative API** — Programmatic control via ref
- **Events & Middleware** — 28 callback hooks + 6 middleware pipeline points for observing and intercepting the chat flow
- **Headless Mode** — Use services, stores, and providers without the widget UI
- **Imperative API** — Ref handle with 24+ methods for messages, threads, profiles, tool approval, and external re-sync
- **Drag-and-drop attachments** — Drop text files and images directly into the chat composer

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

17 built-in AI providers, plus runtime registration of custom ones:

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
| ONLYOFFICE AI | `onlyoffice` | `openai` (compatible) |

See [Providers](docs/providers.md) for custom provider tutorial.

### ONLYOFFICE AI — external configuration

The ONLYOFFICE AI provider is configured by the host, not by the end user. Supply a base URL (and optionally an API key) via the `onlyofficeConfig` prop and it will show up in both **AI Models** and **Web Search** settings with the URL/Key fields hidden:

```tsx
<AIChatWidget
  onlyofficeConfig={{
    baseUrl: "https://my-docspace.example.com",
    apiKey: "optional-bearer-token", // optional
  }}
  // ...other props
/>
```

The API key is optional — when omitted, requests are sent without an `Authorization` header (useful for same-origin / internal deployments). Platform-cloud entries returned by `PlatformAdapter.clouds` are merged into the same list and still require a key.

See [Providers → ONLYOFFICE AI](docs/providers.md#onlyoffice-ai--external--cloud-configuration) for the full flow.

## Tools & MCP

Four tool sources unified by the `Servers` class:

- **Host Tools** — Tools exposed by the host application (e.g. editor commands)
- **Web Search** — Exa / ONLYOFFICE AI integration for real-time web search
- **Image Generation** — Built-in `generate_image` tool routed to the profile assigned to `ActionType.ImageGeneration`
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

## UI Flags

Runtime toggles to adjust built-in UI. Pass directly as `AIChatWidget` props:

| Prop | Type | Effect |
|------|------|--------|
| `hiddenProviders` | `ProviderType[]` | Hide specific providers from the Add/Edit model dropdowns. |
| `hideProfilePicker` | `boolean` | Hide the `Ask <profile>` profile picker row inside the chat composer. The current chat profile is still resolved from the profiles store. |
| `hideSettingsButton` | `boolean` | Hide the gear button in the header. The settings page stays reachable via `router.setCurrentPage("settings")`. |
| `onSettingsClick` | `() => void` | Fully override the click on the header settings button — the built-in `setCurrentPage` toggle is not invoked when this is set. |
| `isSettingsActive` | `boolean` | Force the header settings button into its active (highlighted) state. When `undefined`, falls back to `currentPage === "settings"`. |
| `assistantActions` | `AssistantAction[]` | Extra buttons rendered under every assistant message, appended after the built-in Copy and Save. Each `onClick` receives `{ text, markdown, message }` of the assistant reply. Hidden during streaming and on error states (same as the built-ins). |
| `composerActions` | `ComposerAction[]` | Extra items appended to the composer's `+` (attachments) dropdown, rendered above the built-in Web Search / Extended Thinking block. Each item is `{ id, text, icon?, onClick }` — onClick-only (no toggles or submenus). |
| `onProfileImportClick` | `() => Promise<Partial<ModelFormValues> \| null \| void>` | Handler for the "Import" link in the add-profile card. The host owns the entire import flow (file picker, parsing, `registerProvider`, etc.). Returning a `Partial<ModelFormValues>` pre-fills the form (provider/baseUrl/apiKey/model/profileName); `null`/`undefined` leaves the form untouched. When `provider`+`baseUrl` are returned, the model list is refreshed automatically and any imported `model` is preserved if available. |
| `onDownloadTemplate` | `() => void` | Handler for the "Download template" link in the add-profile card's info tooltip. Used by hosts that ship a downloadable JSON / config template for custom providers. The widget calls `preventDefault`; everything else is the host's responsibility. |

```tsx
<AIChatWidget
  hideProfilePicker
  onSettingsClick={() => openHostSettings()}
  isSettingsActive={isHostSettingsOpen}
  assistantActions={[
    {
      id: "insert-into-doc",
      tooltip: "Insert into document",
      icon: "btn-copy", // built-in IconName, custom registered name, or a React node
      onClick: ({ text }) => host.insertText(text),
      isVisible: ({ text }) => text.length > 0, // optional
    },
  ]}
  composerActions={[
    {
      id: "snippets",
      text: "Snippets",
      icon: "btn-copy", // optional — IconName, custom registered name, or a React node
      onClick: () => host.openSnippetsPicker(),
    },
  ]}
  ...props
/>
```

## Imperative API

Control the widget programmatically via ref:

```tsx
const chatRef = useRef<AIChatWidgetRef>(null);

chatRef.current?.sendMessage("Summarize this document");
chatRef.current?.stopStreaming();
chatRef.current?.openSettings();

<AIChatWidget ref={chatRef} ...props />
```

Methods: `sendMessage`, `stopStreaming`, `isStreaming`, `switchThread`, `createThread`, `deleteThread`, `renameThread`, `clearHistory`, `downloadThread`, `getThreads`, `getCurrentThreadId`, `openChat`, `openSettings`, `openHistory`, `getCurrentPage`, `getProfiles`, `setChatProfile`, `getCurrentProfile`, `approveToolCall`, `denyToolCall`, plus external re-sync: `updateProfiles`, `updateThreads`, `updateCurrentChat`, `updateModelAssignment`, `updateMCPServer`, `updateWebSearch`, `updateExtendedThinking`.

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
import { AIEngine } from "@onlyoffice/ai-chat/services";
import type { Thread, Profile } from "@onlyoffice/ai-chat/types";
import { isDjVu, isPdf } from "@onlyoffice/ai-chat/utils";
```

Available subpaths: `/core`, `/providers`, `/services`, `/storage`, `/middleware`, `/store`, `/tools`, `/events`, `/hooks`, `/pages`, `/platform`, `/imperative`, `/types`, `/styles`, `/styles/themes`.

## Documentation

| Guide | Description |
|-------|-------------|
| [Documentation index](docs/README.md) | Full documentation tree |
| [Getting Started](docs/getting-started.md) | Step-by-step setup with Vite, Next.js |
| [Architecture](docs/architecture.md) | Adapter pattern, `AppContext`, layer cake, data flow |
| [Adapters](docs/adapters.md) | `StorageAdapter`, `SettingsAdapter`, `PlatformAdapter` contracts |
| [Headless Usage](docs/headless-usage.md) | Use `core/` engines without the widget UI |
| [Core services](docs/core/services/README.md) | Nine engine classes — `AIEngine`, `ProfilesEngine`, … |
| [Core providers](docs/core/providers/README.md) | `AbstractBaseProvider`, registry, 17 built-in providers |
| [Core storage](docs/core/storage/README.md) | `StorageAdapter` and the eleven domain sub-storages |
| [Core actions](docs/core/actions/README.md) | One-shot actions (chat, summarization, translation, OCR, …) |
| [Core middleware](docs/core/middleware/README.md) | `ChatMiddleware` pipeline + `MiddlewareRunner` |
| [Shared primitives](docs/shared/README.md) | Provider/model/capability/action types, errors, abort, logger |
| [UI overview](docs/ui/README.md) | React layer index |
| [UI hooks](docs/ui/hooks.md) | `useMessages`, `useProfiles`, `useServers`, `useThread`, helpers |
| [UI pages](docs/ui/pages.md) | The seven exported page components |
| [UI tools](docs/ui/tools.md) | `ToolsProvider`, `Servers`, `HostToolGroup`, MCP transport |
| [Imperative API](docs/ui/providers/imperative.md) | `AIChatWidgetRef` — programmatic widget control |
| [Events](docs/ui/providers/events.md) | `ChatCallbacks`, `ChatEventBus`, `CallbacksManager` |
| [Theming](docs/ui/providers/theme.md) | Built-in themes, custom tokens, dark/light resolution |
| [Locales](docs/ui/providers/locales.md) | i18n: 41 bundled locales, custom translations |
| [Component overrides](docs/ui/providers/components.md) | Override built-in UI primitives |
| [Image overrides](docs/ui/providers/images.md) | Override icons / images |
| [Api provider](docs/ui/providers/api.md) | `ApiProvider` — in-process or remote engine routing |

## License

MIT
