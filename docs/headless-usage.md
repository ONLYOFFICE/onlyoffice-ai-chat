# Headless Usage

Use the library's stores, services, and page components without the
all-in-one `AIChatWidget` wrapper. This is useful when you need:

- Custom layouts or routing
- Direct store/service access from non-React code
- Only specific pages (e.g., just the settings page)
- Programmatic chat control without rendering UI

---

## When to Use Headless Mode

| Scenario | Use |
|----------|-----|
| Drop-in chat sidebar | `AIChatWidget` |
| Custom layout with library pages | Headless with page components |
| Bot / automation (no UI) | Headless with `ChatEngine` only |
| Embed settings page in your own shell | Headless with `SettingsPage` |

---

## Manual AppContext Assembly

The `AppContext` is the dependency injection container. In `AIChatWidget`,
it is built automatically. In headless mode, you assemble it yourself:

```ts
import {
  type AppContext,
  type SettingsAdapter,
  type StorageAdapter,
  type PlatformAdapter,
  CallbacksManager,
  ChatEventBus,
  MiddlewareRunner,
  Servers,
} from "@onlyoffice/ai-chat";
import Provider from "@onlyoffice/ai-chat/providers";

// 1. Create adapters (see adapters.md)
const settings: SettingsAdapter = { /* ... */ };
const storage: StorageAdapter = { /* ... */ };
const platform: PlatformAdapter = { /* ... */ };

// 2. Build the context
const provider = new Provider();
provider.setSettings(settings);

const eventBus = new ChatEventBus();
const servers = new Servers(settings, platform, eventBus);
const callbacksManager = new CallbacksManager();
const middlewareRunner = new MiddlewareRunner([]);

const ctx: AppContext = {
  settings,
  storage,
  platform,
  provider,
  servers,
  eventBus,
  callbacksManager,
  middlewareRunner,
};
```

---

## Creating Stores

Once you have an `AppContext`, create the Zustand store bundle:

```ts
import { createStores } from "@onlyoffice/ai-chat/store";
import type { StoreKeys } from "@onlyoffice/ai-chat";

const storeKeys: StoreKeys = {
  defaultProfile: "ai.defaultProfile",
  chatProfile: "ai.chatProfile",
  summarizationProfile: "ai.summarizationProfile",
  translationProfile: "ai.translationProfile",
  textAnalysisProfile: "ai.textAnalysisProfile",
  imageGenerationProfile: "ai.imageGenerationProfile",
  ocrProfile: "ai.ocrProfile",
  visionProfile: "ai.visionProfile",
  deepMode: "ai.deepMode",
  mcpServers: "ai.mcpServers",
  disabledTools: "ai.disabledTools",
};

const stores = createStores({ keys: storeKeys, ctx });
```

The returned `Stores` object contains all Zustand hooks plus service
instances:

```ts
interface Stores {
  // Zustand store hooks
  useMessageStore:     UseBoundStore<StoreApi<MessageStoreState>>;
  useProfilesStore:    UseBoundStore<StoreApi<ProfilesStoreState>>;
  useThreadsStore:     UseBoundStore<StoreApi<ThreadsStoreState>>;
  useServersStore:     UseBoundStore<StoreApi<ServersStoreState>>;
  usePromptsStore:     UseBoundStore<StoreApi<PromptsStoreState>>;
  useAttachmentsStore: UseBoundStore<StoreApi<AttachmentsStoreState>>;
  useThemeStore:       UseBoundStore<StoreApi<ThemeStoreState>>;
  useRouter:           UseBoundStore<StoreApi<RouterStoreState>>;
  useCloudsStore:      UseBoundStore<StoreApi<CloudsStoreState>>;

  // Services
  chatEngine:          ChatEngine;
  provider:            Provider;
  callbacksManager:    CallbacksManager;
  middlewareRunner:     MiddlewareRunner;

  // Selectors
  selectCurrentChatProfile: (s: ProfilesStoreState) => Profile | null;
}
```

---

## Accessing Stores

Zustand stores from `createStores` are standard `useBoundStore` hooks. Use
them in React components or read/subscribe outside React:

### Inside React

```tsx
function MessageCount() {
  const { useMessageStore } = useStores();
  const messages = useMessageStore((s) => s.messages);
  return <span>{messages.length} messages</span>;
}
```

### Outside React (getState / subscribe)

```ts
// Read current state
const currentMessages = stores.useMessageStore.getState().messages;
const profiles = stores.useProfilesStore.getState().profiles;

// Subscribe to changes
const unsubscribe = stores.useThreadsStore.subscribe((state) => {
  console.log("Threads changed:", state.threads.length);
});
```

---

## Using ChatEngine Directly

`ChatEngine` orchestrates the full message lifecycle. Its methods are async
generators that yield `ChatEvent` objects:

```ts
const { chatEngine } = stores;

// ChatEngine.sendMessage returns AsyncGenerator<ChatEvent>
// It is designed to be consumed by the useMessages hook, but you can
// drive it from your own code by iterating the generator.

// For programmatic access, use the store actions directly:
const { useMessageStore, useProfilesStore } = stores;

// Set up a profile first
const { loadProfiles } = useProfilesStore.getState();
await loadProfiles();

// Access the message store for sending
const { setThreadId } = useMessageStore.getState();
setThreadId("my-thread-id");
```

### ChatEvent Types

```ts
type ChatEvent =
  | { type: "message-start"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-delta"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-end"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-incomplete"; message: ThreadMessageLike }
  | { type: "tool-call-pending"; message: ThreadMessageLike;
      idx: number; messageUID: string }
  | { type: "thread-title"; title: string; profileId?: string };
```

---

## Using Individual Page Components

The library exports page-level components that you can compose into your
own layout. They require the full provider stack to be in place.

### Available Pages

```ts
import {
  ChatPage,
  SettingsPage,
  InitialSetupPage,
  EmptyScreenPage,
  AiModelsPage,
  ModelAssignmentPage,
  McpServersPage,
  WebSearchPage,
} from "@onlyoffice/ai-chat/pages";
```

### Building the Provider Stack

Wrap pages in the required context providers:

```tsx
import {
  EventsProvider,
  CallbacksManager,
  SettingsProvider,
  PlatformProvider,
  I18nProvider,
  ComponentsProvider,
  StoresProvider,
  ThemeProvider,
  ImagesProvider,
  StorageProvider,
  ToolsProvider,
} from "@onlyoffice/ai-chat";
import "@onlyoffice/ai-chat/styles";

function CustomChatApp() {
  // ctx and stores created as shown above

  return (
    <EventsProvider callbacksManager={ctx.callbacksManager}>
      <SettingsProvider settings={ctx.settings}>
        <PlatformProvider platform={ctx.platform}>
          <I18nProvider locale="en">
            <ComponentsProvider>
              <StoresProvider stores={stores}>
                <ThemeProvider theme="light">
                  <ImagesProvider>
                    <ToolsProvider
                      hostToolGroups={[]}
                      servers={ctx.servers}
                      eventBus={ctx.eventBus}
                    >
                      <StorageProvider storage={ctx.storage}>
                        {/* Your custom layout */}
                        <MyCustomLayout />
                      </StorageProvider>
                    </ToolsProvider>
                  </ImagesProvider>
                </ThemeProvider>
              </StoresProvider>
            </ComponentsProvider>
          </I18nProvider>
        </PlatformProvider>
      </SettingsProvider>
    </EventsProvider>
  );
}

function MyCustomLayout() {
  const { useRouter } = useStores();
  const { currentPage } = useRouter();

  switch (currentPage) {
    case "settings":
      return <SettingsPage />;
    case "initial-setup":
      return <InitialSetupPage />;
    default:
      return <ChatPage />;
  }
}
```

---

## Imperative Widget Ref

If you use `AIChatWidget` but need programmatic control, use `ref`:

```tsx
import { useRef } from "react";
import { AIChatWidget, type AIChatWidgetRef } from "@onlyoffice/ai-chat";

function App() {
  const chatRef = useRef<AIChatWidgetRef>(null);

  const sendProgrammatically = () => {
    chatRef.current?.sendMessage("Summarize this document");
  };

  return (
    <>
      <button onClick={sendProgrammatically}>Auto-send</button>
      <AIChatWidget ref={chatRef} storage={storage} settings={settings}
                    platform={platform} storeKeys={storeKeys} />
    </>
  );
}
```

---

## Middleware

Register middleware to intercept the chat lifecycle at various points:

```ts
import type { ChatMiddleware } from "@onlyoffice/ai-chat/middleware";

const loggingMiddleware: ChatMiddleware = {
  beforeSend: async (ctx) => {
    console.log("Sending:", ctx.text);
    return { action: "continue" };
  },
  onStreamChunk: async (ctx) => {
    return { action: "continue" };
  },
  beforeToolCall: async (ctx) => {
    console.log("Tool call:", ctx.toolName, ctx.toolArgs);
    return { action: "continue" };
  },
  afterToolResult: async (ctx) => {
    return { action: "continue" };
  },
  onError: async (ctx) => {
    console.error("Chat error:", ctx.error);
    return { action: "default" };
  },
};

// Pass middleware when creating the AppContext
const middlewareRunner = new MiddlewareRunner([loggingMiddleware]);
```

### Middleware Hooks

| Hook | When | Can |
|------|------|-----|
| `beforeSend` | Before user message sent | Block, modify text/files |
| `onStreamChunk` | Each streamed chunk | Skip, replace chunk |
| `beforeToolCall` | Before tool execution | Deny, approve, modify args |
| `afterToolResult` | After tool returns | Skip, replace result |
| `beforeDisplay` | Before message shown in UI | Skip, replace message |
| `onError` | On any error | Retry, fallback, suppress |
