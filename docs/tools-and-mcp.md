# Tools & MCP

The tool system unifies four tool sources under a single `Servers` class: host tools from the embedding application, web search, image generation, and custom MCP servers communicating over JSON-RPC 2.0.

## Architecture

```
Servers
  +-- HostToolSource      (host app tools, passed via props)
  +-- WebSearch           (Exa / ONLYOFFICE web search)
  +-- ImageGeneration     (built-in `generate_image` tool)
  +-- CustomServers       (MCP servers: HTTP + STDIO transports)
```

The `Servers` class aggregates tools from all sources via `getTools()`, routes `callTools()` to the correct source, and manages the "always allow" list for tool approval.

### Constructor

```ts
new Servers(
  settings: SettingsAdapter,
  platform: PlatformAdapter,
  eventBus: ChatEventBus,
  callbacksManager?: CallbacksManager | null,
);
```

`callbacksManager` is optional when building `Servers` standalone (e.g. in bot scripts); pass one to receive `onWebSearchUpdated` and `onServersUpdated` callbacks.

## Host Tools

Host tools let the embedding application expose capabilities (e.g., document editing, CRM operations) to the AI model.

### Interfaces

```ts
interface HostTool {
  name: string;                                      // e.g. "insert_text"
  description: string;                               // shown to the AI model
  inputSchema: Record<string, unknown>;              // JSON Schema for arguments
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  requireApproval?: boolean;                         // default: false (auto-allow)
}

interface HostToolGroup {
  id: string;       // namespace prefix, e.g. "desktop_editor"
  name: string;     // display name in UI, e.g. "Desktop Editor"
  tools: HostTool[];
}
```

Tool names are automatically prefixed with the group ID when exposed to the model (e.g., `desktop_editor_insert_text`).

### Passing Host Tools

Pass host tool groups via the `hostToolGroups` prop on `AIChatWidget`:

```tsx
import { AIChatWidget } from "@onlyoffice/ai-chat";
import type { HostToolGroup } from "@onlyoffice/ai-chat";

const editorTools: HostToolGroup = {
  id: "editor",
  name: "Document Editor",
  tools: [
    {
      name: "get_selection",
      description: "Get the currently selected text",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ text: editor.getSelection() }),
      // requireApproval defaults to false -- auto-allowed
    },
    {
      name: "insert_text",
      description: "Insert text at the cursor position",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      handler: async (args) => {
        editor.insertText(args.text as string);
        return { success: true };
      },
      requireApproval: true, // user must approve before execution
    },
  ],
};

<AIChatWidget hostToolGroups={[editorTools]} /* ...other props */ />;
```

### `requireApproval`

- `false` (default) -- the tool executes immediately when the AI calls it.
- `true` -- the widget shows an approval dialog. The user can approve once, deny, or select "always allow" to auto-approve future calls.

## Web Search

Web search provides two tools: `web_search` (keyword search) and `web_crawling` (full-page content extraction).

### Supported Providers

- **Exa** -- uses the Exa API (`https://api.exa.ai`). Requires an API key.
- **ONLYOFFICE** -- uses the ONLYOFFICE cloud web search endpoint.

### Configuration

Web search is configured via `ServersService` or the `Servers` class directly:

```ts
servers.setWebSearchData({
  provider: "Exa",
  key: "exa-api-key-...",
});

// Check if enabled
servers.getWebSearchEnabled(); // true

// Disable
servers.setWebSearchData(null);
```

Web search tools are always auto-allowed (no approval dialog).

## Image Generation

The `ImageGeneration` source exposes a single `generate_image` tool that routes at call time to whichever profile is currently bound to `ActionType.ImageGeneration` in Model Assignment (typically a Stability AI or OpenAI image model).

### Activation

The tool is gated on `ImageGeneration.setEnabled(true)` — the widget wires this automatically when the user assigns a non-default image generation profile. There is no UI toggle separate from Model Assignment.

### Tool schema

```json
{
  "name": "generate_image",
  "description": "Generate an image from a textual description.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Detailed description of the image to generate."
      }
    },
    "required": ["prompt"]
  }
}
```

The tool returns a JSON string of the shape `{ "data": { "base64": "..." } }` on success or `{ "error": "..." }` on failure. The widget renders the base64 PNG inline in the chat.

### Auto-approval

Like web search, image generation tool calls are always auto-allowed — `checkAllowAlways("image-generation", ...)` returns `true` unconditionally, and `setAllowAlways` is a no-op for this source.

### Configuration from code

```ts
// Enable programmatically (normally driven by Model Assignment UI)
servers.imageGeneration.setEnabled(true);
servers.imageGeneration.getEnabled();   // true
servers.imageGeneration.getTools();     // [generate_image tool]
```

## Custom MCP Servers

MCP (Model Context Protocol) servers expose tools via JSON-RPC 2.0. The library supports two transports:

### HTTP Transport

The server exposes a single HTTP endpoint that accepts JSON-RPC 2.0 POST requests. Responses may be plain JSON or SSE-formatted.

```json
{
  "mcpServers": {
    "my-http-server": {
      "url": "https://mcp.example.com/rpc",
      "headers": {
        "Authorization": "Bearer token123"
      }
    }
  }
}
```

### STDIO Transport

The server runs as a child process. The library writes JSON-RPC messages to stdin and reads responses from stdout.

```json
{
  "mcpServers": {
    "my-stdio-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

STDIO transport requires the `PlatformAdapter.process.createProcess` method.

### Initialization Protocol

1. The library sends an `initialize` JSON-RPC request with protocol version `"2024-11-05"`.
2. On successful init, it sends `tools/list` to discover available tools.
3. Tools are registered and emitted via the `ChatEventBus` (`"tools-changed"` event).
4. Tool calls use the `tools/call` method with a 30-second timeout.

### Configuration

```ts
servers.setCustomServers({
  mcpServers: {
    "filesystem": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/home"],
    },
    "api-server": {
      url: "https://mcp.example.com/rpc",
    },
  },
});

servers.startCustomServers();
```

## Tool Approval Flow

When the AI model requests a tool call, the approval flow works as follows:

1. **Auto-allow check** -- the `Servers.checkAllowAlways()` method checks:
   - Web search tools are always auto-allowed.
   - Host tools with `requireApproval: false` are auto-allowed.
   - Tools in the persisted "always allow" list are auto-allowed.
2. **Manual approval** -- if not auto-allowed, the widget shows an approval dialog with the tool name and arguments.
3. **User actions**:
   - **Approve** -- execute the tool call once.
   - **Approve + "Always allow"** -- execute and add to the persisted allow list.
   - **Deny** -- reject the tool call and inform the AI model.

The "always allow" list is stored via `SettingsAdapter` as a comma-separated string.

## `ToolSource` Interface

You can implement custom tool sources by conforming to the `ToolSource` interface:

```ts
import type { ToolSource, TMCPItem } from "@onlyoffice/ai-chat";

const mySource: ToolSource = {
  id: "my-custom-source",
  autoAllow: true,

  getTools(): TMCPItem[] {
    return [
      {
        name: "current_time",
        description: "Returns the current UTC time",
        inputSchema: { type: "object", properties: {} },
      },
    ];
  },

  async callTool(name: string, args: Record<string, unknown>) {
    if (name === "current_time") {
      return { time: new Date().toISOString() };
    }
    return {};
  },
};
```

The four built-in `ToolSource` implementations are:
- `HostToolSource` -- wraps `HostToolGroup[]` from the host app.
- `WebSearch` -- Exa/ONLYOFFICE-powered web search.
- `ImageGeneration` -- built-in `generate_image` routed to the Image Generation profile.
- `CustomServers` -- MCP servers via JSON-RPC 2.0 (HTTP and STDIO).

## `Servers` Class API

| Method | Description |
|--------|-------------|
| `getTools()` | Returns all tools from all sources, keyed by source ID |
| `callTools(type, name, args)` | Execute a tool by source type and name |
| `checkAllowAlways(type, name)` | Check if a tool is auto-allowed |
| `setAllowAlways(value, type, name)` | Add/remove a tool from the always-allow list |
| `setCustomServers(config)` | Configure MCP servers |
| `startCustomServers()` | Initialize and connect all configured MCP servers |
| `restartCustomServer(type)` | Restart a specific MCP server |
| `deleteCustomServer(type)` | Stop and remove a specific MCP server |
| `setWebSearchData(data)` | Configure web search provider |
| `getWebSearchEnabled()` | Check if web search is active |
