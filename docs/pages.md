# Page Components

`@onlyoffice/ai-chat` exports 8 page-level components that can be used standalone to build custom layouts, or composed together outside of the default `AIChatWidget` shell.

## Available Pages

| Component | Description |
|-----------|-------------|
| `ChatPage` | Main chat interface with message list, composer, and streaming |
| `SettingsPage` | Profile management, model configuration, and general settings |
| `AiModelsPage` | AI model cards for adding, editing, and deleting profiles |
| `ModelAssignmentPage` | Assign profiles to specific action types (summarize, translate, etc.) |
| `McpServersPage` | MCP server configuration and tool management |
| `WebSearchPage` | Web search (Exa API) configuration |
| `InitialSetupPage` | First-run wizard for creating the initial profile |
| `EmptyScreenPage` | Placeholder shown when no profiles or messages exist |

## Import

All pages are available from the main entry point or the `/pages` subpath:

```ts
import {
  ChatPage,
  SettingsPage,
  AiModelsPage,
  ModelAssignmentPage,
  McpServersPage,
  WebSearchPage,
  InitialSetupPage,
  EmptyScreenPage,
} from "@onlyoffice/ai-chat";
```

## When to Use Standalone Pages

Use `AIChatWidget` when you want the full out-of-the-box experience with built-in routing between chat, settings, and history.

Use standalone pages when you need:

- **Custom layout** -- e.g. chat and settings side-by-side, or settings in a separate route.
- **Selective rendering** -- only show the chat page without settings access.
- **Custom navigation** -- integrate page switching into your own router or tab system.
- **Embedding** -- drop a single page into an existing application shell.

## Required Provider Stack

Standalone pages expect the same providers that `AIChatWidget` sets up internally. You must wrap them in the correct provider stack:

```
EventsProvider
  SettingsProvider
    PlatformProvider
      I18nProvider
        ComponentsProvider
          StoresProvider
            ThemeProvider
              ImagesProvider
                ToolsProvider
                  StorageProvider
                    <Page />
```

The minimal setup:

```tsx
import {
  SettingsProvider,
  PlatformProvider,
  StoresProvider,
  ToolsProvider,
  StorageProvider,
  I18nProvider,
  ThemeProvider,
  ComponentsProvider,
  ImagesProvider,
  EventsProvider,
  CallbacksManager,
  ChatEventBus,
  createStores,
  Servers,
  ChatPage,
  SettingsPage,
} from "@onlyoffice/ai-chat";

function MyApp() {
  const eventBus = useMemo(() => new ChatEventBus(), []);
  const callbacksManager = useMemo(() => new CallbacksManager(), []);
  const servers = useMemo(
    () => new Servers(settings, platform, eventBus),
    [settings, platform, eventBus],
  );
  const stores = useMemo(
    () => createStores({ keys: storeKeys, ctx: { settings, storage, platform, provider, servers, eventBus, callbacksManager, middlewareRunner } }),
    [],
  );

  return (
    <EventsProvider callbacksManager={callbacksManager}>
      <SettingsProvider settings={settings}>
        <PlatformProvider platform={platform}>
          <I18nProvider locale="en">
            <ComponentsProvider>
              <StoresProvider stores={stores}>
                <ThemeProvider>
                  <ImagesProvider>
                    <ToolsProvider hostToolGroups={[]} servers={servers} eventBus={eventBus}>
                      <StorageProvider storage={storage}>
                        <MyLayout />
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
```

## Example: Custom Layout

A two-column layout with chat on the left and settings on the right:

```tsx
function MyLayout() {
  const [page, setPage] = useState<"chat" | "settings">("chat");

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <nav style={{ width: 200, borderRight: "1px solid #ccc" }}>
        <button onClick={() => setPage("chat")}>Chat</button>
        <button onClick={() => setPage("settings")}>Settings</button>
      </nav>

      <main style={{ flex: 1 }}>
        {page === "chat" ? <ChatPage /> : <SettingsPage />}
      </main>
    </div>
  );
}
```

## Notes

- `ChatPage` requires an `AssistantRuntimeProvider` from `@assistant-ui/react` wrapping it for the message runtime. Inside `AIChatWidget` this is handled automatically. When using `ChatPage` standalone, you must provide it yourself (see the `AIChatWidget` source for the runtime setup pattern).
- `EmptyScreenPage` and `InitialSetupPage` are primarily used by the widget's internal routing logic, but can be rendered standalone as landing states.
- Pages read all state from Zustand stores via `useStores()`. Ensure stores are created with the correct `AppContext` dependencies.
