# Getting Started

The fastest path to a working `AIChatWidget`: install, supply three
adapters, render. Read [`architecture.md`](./architecture.md) next
to understand what those adapters wire together; see
[`adapters.md`](./adapters.md) for the full contract of each.

## Installation

```bash
npm install @onlyoffice/ai-chat
# or: yarn add @onlyoffice/ai-chat
# or: pnpm add @onlyoffice/ai-chat
```

React 18 or 19 is a peer dependency:

```bash
npm install react react-dom
```

## What you provide

The widget is headless about persistence, settings, and host
capabilities — you inject all three:

| Adapter | Purpose | Default |
| --- | --- | --- |
| [`SettingsAdapter`](./adapters.md#settingsadapter) | Synchronous key/value (e.g. `localStorage`) | None — required |
| [`StorageAdapter`](./adapters.md#storageadapter) | Threads, messages, profiles, prompts, MCP, … | None — required |
| [`PlatformAdapter`](./adapters.md#platformadapter) | File picker, process runner, theme/locale env | None — required (sub-adapters may be `null`) |
| `StoreKeys` | Maps logical names to settings keys | None — required |

Each sub-adapter inside `PlatformAdapter` is **nullable**. The
widget hides any UI tied to a missing capability automatically —
no flag soup needed.

## Minimal example

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type {
  SettingsAdapter,
  StorageAdapter,
  PlatformAdapter,
  StoreKeys,
} from "@onlyoffice/ai-chat";
import "@onlyoffice/ai-chat/styles";

const settings: SettingsAdapter = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
  remove: (k) => localStorage.removeItem(k),
};

const storage: StorageAdapter = /* your IndexedDB adapter — see adapters.md */;

const platform: PlatformAdapter = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: "light",
    systemTheme: "light",
    locale: "en",
    devicePixelRatio: window.devicePixelRatio,
  },
};

const storeKeys: StoreKeys = {
  defaultProfile: "ai-chat.defaultProfile",
  chatProfile: "ai-chat.chatProfile",
  summarizationProfile: "ai-chat.summarizationProfile",
  translationProfile: "ai-chat.translationProfile",
  textAnalysisProfile: "ai-chat.textAnalysisProfile",
  imageGenerationProfile: "ai-chat.imageGenerationProfile",
  ocrProfile: "ai-chat.ocrProfile",
  visionProfile: "ai-chat.visionProfile",
  deepMode: "ai-chat.deepMode",
  mcpServers: "ai-chat.mcpServers",
  disabledTools: "ai-chat.disabledTools",
  systemPromptAppendix: "ai-chat.systemPromptAppendix",
};

export default function App() {
  return (
    <AIChatWidget
      storage={storage}
      settings={settings}
      platform={platform}
      storeKeys={storeKeys}
      locale="en"
      theme="theme-light"
    />
  );
}
```

## Framework notes

### Vite

Works out of the box; just import `@onlyoffice/ai-chat/styles` once.

### Next.js (App Router)

The widget uses `localStorage`, `IndexedDB`, and `window`. Render it
in a client boundary:

```tsx
"use client";
import { AIChatWidget } from "@onlyoffice/ai-chat";
import "@onlyoffice/ai-chat/styles";
```

Import `@onlyoffice/ai-chat/styles` (and optionally
`@onlyoffice/ai-chat/styles/themes`) from `app/layout.tsx` or any
client component.

### Next.js (Pages Router)

Import the stylesheet from `pages/_app.tsx`.

## Where to read next

- [`architecture.md`](./architecture.md) — how adapters, engines,
  stores, providers, and middleware fit together.
- [`adapters.md`](./adapters.md) — full contract for each adapter
  with copy-pasteable examples.
- [`headless-usage.md`](./headless-usage.md) — driving `AIEngine`
  directly without rendering the widget.
- [`ui/providers/imperative.md`](./ui/providers/imperative.md) — `AIChatWidgetRef` for
  programmatic control while keeping the UI.
- [`ui/providers/theme.md`](./ui/providers/theme.md) — picking,
  overriding, and registering themes.
- [`ui/providers/locales.md`](./ui/providers/locales.md) — picking
  a locale, overriding strings, registering custom languages.
