# Tools (UI side)

`Servers` is the UI-side aggregator over the **external** tool
providers — the host (`hostToolSource`) and the user's MCP
servers (`customServers`). It lives in `ui/tools/` because it
consumes `PlatformAdapter` and the React event bus. Pages and
hooks consume it through `ToolsProvider` / `useToolsContext`.

Built-in tools (web-search, image-generation) are sourced and
dispatched **engine-side** — they never go through `Servers`. See
[`core/services/web-search`](../core/services/web-search-engine.md)
and [`core/services/ai/sources/image-generation.ts`](../../src/core/services/ai/sources/image-generation.ts).

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
} from "@onlyoffice/ai-chat/tools";
```

## Architecture

```
Servers (UI)
├── HostToolSource    — tools registered via PlatformHostTools / hostToolGroups
└── CustomServers     — MCP servers via JSON-RPC 2.0 (HTTP + STDIO)

Engine (server-side, see core/services/ai/tools.ts)
├── ToolsAdapter         — pluggable runtime tool source (optional)
├── getWebSearchTools     — built-in, gated by storage.webSearch
└── getImageGenerationTools — built-in, gated by an explicit
                             ActionType.ImageGeneration assignment
```

The chat lifecycle:

1. `useMessages` reads the **flat** UI tool list from
   `useServersStore.tools` (host + MCP custom, all of them — UI
   no longer filters disabled, the engine does).
2. `api.ai.sendWithStream({ actionArgs: { tools } })` → engine.
3. Engine merges UI tools with adapter-served tools and built-ins
   in `buildToolContext`, applies the `storage.toolPrefs.disabled`
   filter, and feeds the result to the model.
4. When the model picks a built-in / adapter tool, the engine
   executes it server-side and resumes — UI never sees a pending
   event for those.
5. When the model picks a host or MCP tool, the engine emits
   `tool-call-pending` with `autoAllow` derived from
   `storage.toolPrefs.allowAlways`. UI dispatches via
   `servers.callTools(...)` and resumes via
   `api.ai.approveToolCall({ result })`.

## Constructor

```ts
new Servers(platform: PlatformAdapter, eventBus: ChatEventBus);
```

Just two args — no `SettingsAdapter`, no `AssignmentsEngine`, no
`CallbacksManager`. Web-search config and allow-always state live
server-side now (`storage.webSearch` and `storage.toolPrefs`),
reached through `api.webSearch` / `api.tools`.

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
</ToolsProvider>
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
| `getTools()` | Returns host + MCP custom tools, grouped by source id |
| `callTools(type, name, args)` | Execute a tool by source type + name |
| `getServerType(name)` | Reverse-lookup the source type for a prefixed tool name |
| `setCustomServers(config)` / `startCustomServers()` / `restartCustomServer(type)` / `deleteCustomServer(type)` | Custom MCP server lifecycle |
| `getCustomServers()` / `getCustomServersStoped()` / `getCustomServersLogs()` | Custom MCP server runtime state |
| `getHostToolGroupIds()` | Group ids registered via `hostToolGroups` |

Allow-always state is owned by `storage.toolPrefs` server-side.
The engine reads it inline when emitting `tool-call-pending`; the
`approveToolCall` payload's `allowAlways: true` flag persists new
entries. The UI no longer reads or writes the list directly.

For full method coverage, read
[`src/ui/tools/servers.ts`](../../src/ui/tools/servers.ts).

## Built-in source authoring

When you need a new server-side tool source (similar to the
built-in web-search / image-generation), drop it under
[`src/core/services/ai/sources/`](../../src/core/services/ai/sources/)
or in its own engine folder:

```ts
// in `core/services/<your-feature>/source.ts`
export const YOUR_TYPE = "your-type";

export async function getYourTools(storage: StorageAdapter): Promise<TMCPItem[]> {
  // gate availability on storage state, return tool descriptors
}

export async function callYourTool(
  storage: StorageAdapter,
  bareName: string,
  args: Record<string, unknown>
): Promise<string> {
  // dispatch by `bareName`, return JSON.stringify(...)
}
```

Then wire it into [`buildToolContext`](../../src/core/services/ai/tools.ts)
and [`dispatchAdapterTool`](../../src/core/services/ai/tools.ts).
