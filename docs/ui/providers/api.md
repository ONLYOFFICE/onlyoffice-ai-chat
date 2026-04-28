# `ApiProvider`

`ApiProvider` injects a `ServerAPI` value used by every page and
hook to talk to the engines. By default it routes calls in-process
to local engine instances (`AIEngine`, `ProfilesEngine`, …); pass
an `origin`/`baseUrl` to route them to a remote HTTP server
implementing the same routes.

This indirection is what enables hosting the engines on a server
while keeping the React UI in the browser.

```ts
import {
  ApiProvider,
  createServerAPI,
  DEFAULT_SERVER_API_ROUTES,
  useApi,
  type ServerAPIConfig,
  type ServerAPIEngines,
} from "@onlyoffice/ai-chat/providers/ApiProvider";
```

> Note: `ApiProvider` is exported from the main entry point too —
> `import { ApiProvider } from "@onlyoffice/ai-chat"`.

## `ServerAPIConfig`

```ts
interface ServerAPIConfig {
  origin: string;                       // "" → in-process
  baseUrl: string;                      // prepended to every route
  headers?: Record<string, string>;     // forwarded with every fetch
  routes: ServerAPIRoutes;              // per-engine route map
}
```

`origin === ""` (the default inside `AIChatWidget`) makes every
method call run in-process against the `engines` you pass to the
provider. Set `origin` to your server's URL to route calls over
HTTP instead.

## `ServerAPIEngines`

When `origin` is empty, the provider needs the local engine
instances:

```ts
interface ServerAPIEngines {
  ai:          AIEngine;
  assignments: AssignmentsEngine;
  preferences: PreferencesEngine;
  profiles:    ProfilesEngine;
  prompts:     PromptsEngine;
  threads:     ThreadsEngine;
  tools:       ToolsEngine;
  webSearch:   WebSearchEngine;
}
```

`AIChatWidget` constructs these for you. In a custom mount, build
them yourself — see [`../../headless-usage.md`](../../headless-usage.md).

## Default routes

Each engine ships a `DEFAULT_*_ROUTES` constant. They are
aggregated into `DEFAULT_SERVER_API_ROUTES`:

```ts
import { DEFAULT_SERVER_API_ROUTES } from "@onlyoffice/ai-chat";

const config: ServerAPIConfig = {
  origin: "",        // in-process
  baseUrl: "",
  routes: DEFAULT_SERVER_API_ROUTES,
};
```

Each route is a `RouteSpec` `{ method: HttpMethod, path: string }`.
You can override individual routes (e.g. to nest under
`/api/chat/`):

```ts
import {
  DEFAULT_SERVER_API_ROUTES,
  type ServerAPIRoutes,
} from "@onlyoffice/ai-chat";

const customRoutes: ServerAPIRoutes = {
  ...DEFAULT_SERVER_API_ROUTES,
  threads: {
    ...DEFAULT_SERVER_API_ROUTES.threads,
    list: { method: "GET", path: "/v1/threads" },
  },
};
```

## In-process usage (the `AIChatWidget` default)

```tsx
const config: ServerAPIConfig = {
  origin: "",
  baseUrl: "",
  routes: DEFAULT_SERVER_API_ROUTES,
};

<ApiProvider config={config} engines={engines}>
  <App />
</ApiProvider>;
```

## Remote usage

```tsx
const config: ServerAPIConfig = {
  origin: "https://api.example.com",
  baseUrl: "/v1/ai-chat",
  headers: { Authorization: `Bearer ${token}` },
  routes: DEFAULT_SERVER_API_ROUTES,
};

<ApiProvider config={config}>{/* engines optional */}
  <App />
</ApiProvider>;
```

Every method call now becomes `fetch(${origin}${baseUrl}${path})`
with the configured headers. Implement those routes on the server
by mounting the same engines against your storage.

## `useApi`

```ts
const api = useApi();

await api.profiles.list();
await api.threads.openOrCreate({ /* … */ });
for await (const ev of api.ai.sendStream({ /* … */ })) { /* … */ }
```

The shape of each slice mirrors the matching engine's public
surface; see the engine docs under
[`../../core/services/`](../../core/services/) for method-level
detail.

## `createServerAPI`

If you need the API outside React, build it directly:

```ts
const api = createServerAPI(config, engines);
await api.profiles.list();
```

This is the same call `ApiProvider` makes internally.
