# Tools (UI side)

`Servers` is the unified tool runtime that lives in `ui/tools/`.
It aggregates four tool sources, decides which need user approval,
and executes calls on behalf of the active provider. Pages and
hooks consume it through `ToolsProvider` / `useToolsContext`.

For the **persistence** side — custom MCP server CRUD, per-tool
disabled / auto-approve flags — see
[`../core/services/tools-engine.md`](../core/services/tools-engine.md).
This doc covers the runtime / UI surface.

```ts
import {
  ToolsProvider,
  useToolsContext,
  Servers,
} from "@onlyoffice/ai-chat/tools";
import type {
  HostTool,
  HostToolGroup,
  ToolSource,
} from "@onlyoffice/ai-chat/tools";
```

## Architecture

```
Servers
├── HostToolSource    — tools registered via PlatformHostTools / hostToolGroups
├── WebSearch         — Exa or ONLYOFFICE web search (always auto-approved)
├── ImageGeneration   — built-in `generate_image` (always auto-approved)
└── CustomServers     — MCP servers via JSON-RPC 2.0 (HTTP + STDIO)
```

`Servers.checkAllowAlways(type, name)` decides whether a call needs
approval. `Servers.callTools(type, name, args)` routes to the right
source. The persistent allow-list is stored under
`SettingsAdapter` key `"allowAlwaysTools"` (comma-separated).

## Constructor

```ts
new Servers(
  settings: SettingsAdapter,
  platform: PlatformAdapter,
  eventBus: ChatEventBus,
  assignments: AssignmentsEngine,
  callbacksManager?: CallbacksManager | null,
);
```

`callbacksManager` is optional — pass one to receive
`onWebSearchUpdated` / `onServersUpdated` events. `assignments` is
used by `ImageGeneration` to resolve the profile bound to
`ActionType.ImageGeneration` at call time.

## `ToolsProvider`

Wraps the tree and exposes `Servers` plus the host tool groups via
context.

```tsx
<ToolsProvider
  hostToolGroups={[editorTools]}
  servers={servers}
  eventBus={eventBus}
>
  <App />
</ToolsProvider>;
```

Inside any descendant:

```ts
const { servers, hostToolGroups, eventBus } = useToolsContext();
```

## Host tools

Host tools let the embedding application expose capabilities (e.g.
"insert text into the active document") to the model. Pass them
via the `hostToolGroups` prop on `AIChatWidget`.

```ts
const editorTools: HostToolGroup = {
  id: "desktop_editor",
  name: "Desktop Editor",
  tools: [
    {
      name: "get_selection",
      description: "Get the currently selected text",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ text: editor.getSelection() }),
      // requireApproval defaults to false — auto-allowed
    },
    {
      name: "insert_text",
      description: "Insert text at the cursor",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      handler: async (args) => {
        editor.insertText(args.text as string);
        return { success: true };
      },
      requireApproval: true,
    },
  ],
};
```

Tool names are namespaced by group id when exposed to the model:
`desktop_editor_get_selection`, `desktop_editor_insert_text`.

`requireApproval`:
- `false` (default) — execute immediately.
- `true` — show approval dialog. The user can approve once, deny,
  or pick "always allow" to auto-approve future calls.

## Web search

Two tools: `web_search` (keyword) and `web_crawling` (full-page
extraction). Providers: `Exa` and `ONLYOFFICE`. Always
auto-approved.

Configuration is normally driven by the `WebSearchPage` UI through
`WebSearchEngine` — see
[`../core/services/web-search-engine.md`](../core/services/web-search-engine.md).

Programmatic toggle:

```ts
servers.webSearch.setData({ provider: "Exa", key: "exa-..." });
servers.webSearch.getEnabled(); // true
servers.webSearch.setData(null);
```

## Image generation

The `ImageGeneration` source exposes a single `generate_image` tool
that routes at call time to whichever profile is bound to
`ActionType.ImageGeneration` (typically Stability AI or OpenAI).
Always auto-approved. Enabled automatically when a non-`Default`
image generation profile is bound.

## Custom MCP servers

Two transports:

### HTTP

```json
{
  "mcpServers": {
    "my-http": {
      "url": "https://mcp.example.com/rpc",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}
```

### STDIO

```json
{
  "mcpServers": {
    "my-stdio": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

STDIO requires `PlatformAdapter.process.createProcess`.

### JSON-RPC handshake

1. `initialize` (protocol version `"2024-11-05"`)
2. `tools/list` to discover tools
3. `tools/call` for each invocation (30-second timeout)

The runtime emits `"tools-changed"` on `ChatEventBus` whenever the
tool list changes; `useServers` subscribes to refresh the UI.

## `Servers` API

| Method | Description |
| --- | --- |
| `getTools()` | Returns all tools from all sources, keyed by source id |
| `callTools(type, name, args)` | Execute a tool by source type + name |
| `checkAllowAlways(type, name)` | True iff the tool should auto-approve |
| `setAllowAlways(value, type, name)` | Add to / remove from the persistent allow list |

For full method coverage, read
[`src/ui/tools/servers.ts`](../../src/ui/tools/servers.ts).

## Custom `ToolSource`

```ts
const mySource: ToolSource = {
  id: "my-custom-source",
  autoAllow: true,
  getTools() {
    return [
      {
        name: "current_time",
        description: "Returns the current UTC time",
        inputSchema: { type: "object", properties: {} },
        source: "my-custom-source",
        checked: true,
      },
    ];
  },
  async callTool(_name, _args) {
    return { time: new Date().toISOString() };
  },
};
```

Built-in implementations: `HostToolSource`, `WebSearch`,
`ImageGeneration`, `CustomServers`. See
[`src/ui/tools/sources/`](../../src/ui/tools/sources/).
