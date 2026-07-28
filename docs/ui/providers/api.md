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

Each route is a `RouteSpec` `{ method: HttpMethod, path: string,
params?: string[] }`. For `GET` routes, `params` names the method's
positional arguments in order; the transport serializes them into
the query string (`undefined`/`null` args are omitted, non-string
values are `JSON.stringify`-ed — e.g. a pagination `cursor` object
travels as a JSON query value). You can override individual routes
(e.g. to nest under `/api/chat/`):

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

### Cursor pagination on the server (Express)

With `enablePagination` on, `threads/list` and
`threads/read-messages` receive extra query params: `count` (number),
`cursor` (a JSON-encoded keyset object) and — for `threads/list` when
the user searches the sidebar — `query` (a case-insensitive title
substring). An Express route parses them and passes them positionally
into the engine method:

```ts
app.get("/v1/ai-chat/threads/list", async (req, res) => {
  const { entityId, count, cursor, query } = req.query;
  res.json(
    await threadsEngine.list(
      entityId as string | undefined,
      count ? Number(count) : undefined,
      cursor ? JSON.parse(cursor as string) : undefined,
      (query as string | undefined) || undefined
    )
  );
});
```

The storage behind the engine implements the keyset query. SQL
sketch for threads (cursor = `{ lastEditDate, threadId }` of the
last row the client already has; `NULL` dates sort last):

```sql
SELECT * FROM threads
WHERE entity_id <=> :entityId
  AND (last_edit_date, thread_id) < (:cursorDate, :cursorThreadId)
  AND (:query IS NULL OR LOWER(title) LIKE CONCAT('%', LOWER(:query), '%'))
ORDER BY last_edit_date DESC, thread_id DESC
LIMIT :count;
```

`query` MUST be a case-insensitive substring match on `title` — the
widget verifies returned titles against that contract and falls back
to client-side filtering if the parameter was ignored.

Messages page ascending with cursor `{ createdAt, id }` (`createdAt`
arrives as an ISO string): `WHERE thread_id = :threadId AND
(created_at, id) > (:cursorCreatedAt, :cursorId) ORDER BY
created_at ASC, id ASC LIMIT :count`.

Recommended composite indexes: `threads(last_edit_date, thread_id)`
and `messages(thread_id, created_at, id)`.

A request without `count`/`cursor` must return the full list — that
is what the widget sends when `enablePagination` is off, and it
keeps old widget versions working against a new server.

### Streaming routes (NDJSON)

The four streaming methods on `AIEngine` —
`sendWithStream`, `regenerateStream`, `approveToolCall`,
`denyToolCall` — round-trip as **newline-delimited JSON** over HTTP:

- `Content-Type: application/x-ndjson; charset=utf-8`
- One `ChatEvent` per line, separated by `\n`
- Headers flushed immediately (`X-Accel-Buffering: no`,
  `Cache-Control: no-cache, no-transform`)
- No SSE `data:` prefix, no terminator sentinel

The remote branch consumes the response body chunk-by-chunk and
exposes the result as the same `AsyncIterable<ChatEvent>` you'd
get from calling the engine directly — `for await (const event
of api.ai.sendWithStream(...))` works identically in headless and
remote mode. Non-2xx responses surface as an error thrown from
the first iteration.

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
