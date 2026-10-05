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
   `tool-call-pending` with `autoAllow` derived from the tool
   permission mode (the composer's "Permissions" row),
   `storage.toolPrefs.allowAlways` and the tool's `requireApproval`. UI dispatches via
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
      // requireApproval defaults to false — auto-allowed under the "auto" mode
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
- `false` (default) — execute immediately while the permission mode is
  `"auto"` (the default mode). Under `"ask"` the dialog shows anyway,
  unless the user has picked "always allow" for the tool.
- `true` — show approval dialog. The user can approve once, deny,
  or pick "always allow" to auto-approve future calls.

MCP tools never set `requireApproval`; under `"auto"` their
`annotations` decide instead: `readOnlyHint: true` or an explicit
`destructiveHint: false` runs without the dialog, a destructive or
unannotated tool asks (the protocol's default is destructive).

The permission mode (`"ask" | "auto" | "allow"`, the composer's
"Permissions" row) sits above both: `"allow"` runs every tool without
asking. See [`preferences-engine.md`](../core/services/preferences-engine.md).

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
2. `notifications/initialized` (stdio only — the HTTP path negotiates its
   session in `initHttpServer`)
3. `tools/list` to discover tools
4. `tools/call` for each invocation (30-second timeout)

### Dynamic tool lists (stdio)

A stdio server that advertises `capabilities.tools.listChanged` may push
`notifications/tools/list_changed` at any time. The runtime answers with
a fresh `tools/list`, replaces that server's group in the tool map and
emits `"tools-changed"`, so the permission cards and the next chat round
pick the new catalog up without a restart. Notifications are debounced
(250 ms) and never overlap an in-flight listing — a notification that
lands while one is pending queues exactly one more listing after the
answer. Prompt and resource `list_changed` notifications are logged and
ignored. The server's `capabilities` from `initialize` are kept in
`CustomServers.serverCapabilities` for diagnostics.

A refresh applies to the *next* user message: the tool list is read once
per send, so a catalog change during a multi-round tool loop shows up on
the following turn.

Stdout is line-framed: chunks may carry several `\n`-separated messages
or a fragment of one, and are reassembled before parsing. Requests the
server sends to the client are answered too — `ping` with an empty
result, anything else with JSON-RPC `-32601`.

HTTP servers are not covered yet: in Streamable HTTP these notifications
travel over a separate `GET` SSE stream the browser client does not open.

An `initialize` result may carry an `instructions` string — the
server's own hint on how its tools are meant to be used. It is
captured per server (see `getToolInstructions()` below), shipped
with the next chat round as `actionArgs.toolInstructions`, and
folded into the system prompt by the `chat` action — see
[MCP server instructions](../core/actions/actions.md#mcp-server-instructions).
The entry is dropped when a re-init stops advertising one, so a
restarted server can't leave stale text in the prompt.

The runtime emits `"tools-changed"` on `ChatEventBus` whenever the
tool list changes; `useServers` subscribes to refresh the UI.

## `Servers` API

| Method | Description |
| --- | --- |
| `getTools()` | Returns host + MCP custom tools, grouped by source id |
| `getToolInstructions()` | Per-server `initialize` instructions, keyed by server type (MCP servers only — host tools have no handshake) |
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
