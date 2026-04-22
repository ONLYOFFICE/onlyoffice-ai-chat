# Page Components

`@onlyoffice/ai-chat` exports 7 page-level components that can be used standalone to build custom layouts, or composed together outside of the default `AIChatWidget` shell.

## Available Pages

| Component | Description |
|-----------|-------------|
| `ChatPage` | Main chat interface with message list, composer, streaming, and the first-run (initial-setup) flow rendered inline when no profiles exist |
| `SettingsPage` | Profile management, model configuration, and general settings |
| `AiModelsPage` | AI model cards for adding, editing, and deleting profiles |
| `ModelAssignmentPage` | Assign profiles to specific action types (summarize, translate, image generation, OCR, vision, etc.) |
| `McpServersPage` | MCP server configuration and tool management |
| `WebSearchPage` | Web search (Exa / ONLYOFFICE AI) configuration |
| `EmptyScreenPage` | Placeholder shown when no profiles or messages exist |

Note: there is no separate `InitialSetupPage` export. The first-run wizard is rendered inside `ChatPage` automatically when the profile list is empty.

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

- `ChatPage` now wires its own `AssistantRuntimeProvider` internally — no extra provider is required around it. Historically this was the caller's responsibility; that changed when `AssistantRuntimeProvider` was moved into `ChatPage`.
- `ChatPage` also renders the first-run setup flow internally when `useProfilesStore` has no profiles, so you do not need a separate `InitialSetupPage` route.
- `EmptyScreenPage` is primarily used by the widget's internal routing logic but can be rendered standalone as a landing state.
- Pages read all state from Zustand stores via `useStores()`. Ensure stores are created with the correct `AppContext` dependencies.
