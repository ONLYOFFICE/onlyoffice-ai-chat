# Pages

Seven page-level components compose the widget's UI. They are
exported individually so you can mount them in a custom layout
(side-by-side, custom routing, embedded settings, etc.).

```ts
import {
  ChatPage,
  SettingsPage,
  AiModelsPage,
  ModelAssignmentPage,
  McpServersPage,
  WebSearchPage,
  EmptyScreenPage,
} from "@onlyoffice/ai-chat/pages";
```

## What each page does

| Page | Responsibility |
| --- | --- |
| `ChatPage` | Message list + composer + streaming. Renders the first-run setup wizard inline when no profiles exist; wires its own `AssistantRuntimeProvider`. |
| `SettingsPage` | Top-level settings screen (entry to AI models, model assignment, MCP, web search, prompts). |
| `AiModelsPage` | Add / edit / delete provider profiles. |
| `ModelAssignmentPage` | Bind profiles to `ActionType` slots (Chat, Summarization, Translation, OCR, Vision, …). |
| `McpServersPage` | Configure custom MCP servers; toggle individual tools. |
| `WebSearchPage` | Web-search provider config (Exa, ONLYOFFICE). |
| `EmptyScreenPage` | Placeholder used by internal routing; renderable standalone as a landing state. |

There is no separate `InitialSetupPage` — `ChatPage` renders the
first-run flow inline whenever `useProfilesStore` is empty.

## Standalone usage

Pages read state through `useStores()` and require the same
provider stack `AIChatWidget` sets up internally. Replicate the
chain:

```
EventsProvider
  PlatformProvider
    I18nProvider
      ComponentsProvider
        WidgetConfigProvider
          ApiProvider
            StoresProvider
              ThemeProvider
                ImagesProvider
                  ToolsProvider
                    <Page />
```

Minimal mount:

```tsx
import { useMemo } from "react";
import {
  AIEngine, AssignmentsEngine, PreferencesEngine, ProfilesEngine,
  PromptsEngine, ThreadsEngine, ToolsEngine, WebSearchEngine,
} from "@onlyoffice/ai-chat/services";
import {
  CallbacksManager,
  EventsProvider,
} from "@onlyoffice/ai-chat/events";
import { MiddlewareRunner } from "@onlyoffice/ai-chat/middleware";
import { PlatformProvider } from "@onlyoffice/ai-chat/platform";
import { ToolsProvider, Servers } from "@onlyoffice/ai-chat/tools";
import { createStores, StoresProvider } from "@onlyoffice/ai-chat/store";
import { ChatPage, SettingsPage } from "@onlyoffice/ai-chat/pages";
import {
  ApiProvider,
  ComponentsProvider,
  DEFAULT_SERVER_API_ROUTES,
  I18nProvider,
  ImagesProvider,
  ThemeProvider,
  WidgetConfigProvider,
  createServerAPI,
  type ServerAPIConfig,
  // re-exported via the main entry point
} from "@onlyoffice/ai-chat";
import { ChatEventBus } from "@onlyoffice/ai-chat/events";

function CustomShell() {
  const { ctx, stores, engines, serverApiConfig } = useMemo(() => {
    const eventBus = new ChatEventBus();
    const callbacksManager = new CallbacksManager();
    const middlewareRunner = new MiddlewareRunner([]);

    const assignments = new AssignmentsEngine({ storage });
    const profiles = new ProfilesEngine({ storage, assignments });
    const threads = new ThreadsEngine({ storage });
    const tools = new ToolsEngine({ storage });
    const prompts = new PromptsEngine({ storage });
    const webSearch = new WebSearchEngine({ storage });
    const preferences = new PreferencesEngine({ storage });

    const servers = new Servers(platform, eventBus);

    const ai = new AIEngine({ storage, assignments, threads });

    const ctx = {
      storage, platform, servers, eventBus,
      callbacksManager, middlewareRunner,
    };

    const engines = {
      ai, assignments, preferences, profiles, prompts,
      threads, tools, webSearch,
    };

    const serverApiConfig: ServerAPIConfig = {
      origin: "",
      baseUrl: "",
      routes: DEFAULT_SERVER_API_ROUTES,
    };

    const api = createServerAPI(serverApiConfig, engines);
    const stores = createStores({ keys: storeKeys, ctx, api });
    return { ctx, stores, engines, serverApiConfig };
  }, []);

  return (
    <EventsProvider callbacksManager={ctx.callbacksManager}>
      <PlatformProvider platform={platform}>
        <I18nProvider locale="en">
          <ComponentsProvider>
            <WidgetConfigProvider config={{}}>
              <ApiProvider config={serverApiConfig} engines={engines}>
                <StoresProvider stores={stores}>
                  <ThemeProvider>
                    <ImagesProvider>
                      <ToolsProvider
                        hostToolGroups={[]}
                        servers={ctx.servers}
                        eventBus={ctx.eventBus}
                      >
                        <ChatPage />
                      </ToolsProvider>
                    </ImagesProvider>
                  </ThemeProvider>
                </StoresProvider>
              </ApiProvider>
            </WidgetConfigProvider>
          </ComponentsProvider>
        </I18nProvider>
      </PlatformProvider>
    </EventsProvider>
  );
}
```

For a runnable end-to-end version, see how
[`AIChatWidget.tsx`](../../src/AIChatWidget.tsx) assembles the
chain.

## Custom routing example

```tsx
function CustomLayout() {
  const { useRouter } = useStores();
  const { currentPage } = useRouter();

  return (
    <div className="grid grid-cols-2 h-screen">
      <ChatPage />
      {currentPage === "settings" ? <SettingsPage /> : <EmptyScreenPage />}
    </div>
  );
}
```

## Notes

- `ChatPage` wires its own `AssistantRuntimeProvider`. No extra
  provider is required around it.
- Pages read all state from Zustand stores via `useStores()`.
  Ensure stores are created from the matching `AppContext`.
- `EmptyScreenPage` is primarily an internal routing fallback but
  is renderable on its own as a landing state.
