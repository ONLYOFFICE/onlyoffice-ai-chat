# `ToolsEngine`

> Source: [`src/core/services/tools/`](../../../src/core/services/tools)

`ToolsEngine` is the persistence orchestrator for custom MCP
servers and per-tool preferences (disabled list + auto-approve
list). It wraps `storage.mcpServers` and `storage.toolPrefs` with
the rules that plain CRUD can't express:

- **Server-name + transport-config validation** for MCP
  registrations, surfaced as `TErrorData` for the settings form.
- **Idempotent writes** for tool prefs — no `create` vs `update`
  branching at call sites.
- **Bulk import** of the server registry with all-or-nothing
  semantics.
- **Token-format centralisation** for the auto-approve list
  (`${serverType}_${toolName}`) so callers never reconstruct it
  themselves.

## Persistence-only — not the runtime aggregator

The engine does **not** manage live MCP connections, fetch
`tools/list` from a running server, or dispatch tool calls. Those
concerns live in [`src/tools/servers.ts`](../../../src/tools/servers.ts)
and the source classes under [`src/tools/sources/`](../../../src/tools/sources/),
which are browser- and transport-bound (HTTP/SSE for HTTP MCP,
host process bridge for STDIO MCP, Exa SDK for web search).

`ToolsEngine` is the part that runs equally on the server — it
sees only the persisted shape, not the live connection.

---

## Construction

```ts
import { ToolsEngine } from "@/core/services";

const engine = new ToolsEngine({ storage });
```

```ts
type ToolsEngineDeps = {
  storage: StorageAdapter;
};
```

The engine is stateless across calls; share one instance per
`AppContext`.

---

## Methods at a glance

| Method                                                     | Returns                                | Persists?                          | Validates? |
| ---------------------------------------------------------- | -------------------------------------- | ---------------------------------- | ---------- |
| [`addCustomServer`](#addcustomserver)                      | `ToolsMutationResult`                  | `mcpServers.create`                | ✅ name + transport |
| [`updateCustomServer`](#updatecustomserver)                | `ToolsMutationResult`                  | `mcpServers.update`                | ✅ transport |
| [`removeCustomServer`](#removecustomserver)                | `void`                                 | `mcpServers.delete` (no-op if missing) | ❌         |
| [`getCustomServer`](#getcustomserver) / [`listCustomServers`](#listcustomservers) | `McpServerConfig \| null` / `Record<…>` | ❌                                  | ❌         |
| [`replaceAllCustomServers`](#replaceallcustomservers)      | `ToolsBulkResult`                      | `mcpServers.replaceAll`            | ✅ every entry |
| [`setDisabled`](#setdisabled) / [`getDisabled`](#getdisabled) / [`isToolDisabled`](#istooldisabled) | `void` / `Record<…>` / `boolean` | `toolPrefs.upsertDisabled` | ❌         |
| [`setAllowAlways`](#setallowalways) / [`getAllowAlways`](#getallowalways) / [`isAllowAlways`](#isallowalways) | `void` / `string[]` / `boolean` | `toolPrefs.upsertAllowAlways` | ❌         |

---

## Custom MCP servers

### Validation

> Source: [`validation.ts`](../../../src/core/services/tools/validation.ts)

Two predicates, both exported:

```ts
validateServerName(name: string): TErrorData | null;
validateTransportConfig(config: McpServerConfig): TErrorData | null;
```

- **Name** — non-empty, may not contain `_`. The live tool system
  uses `${type}_${name}` as a token format for `allowAlways` and
  tool-call dispatch, so an underscore in the name would
  ambiguate the parser.
- **Transport config** — must match exactly one of:
  - HTTP: `{ url: string, headers?: Record<string, string> }`
  - STDIO: `{ command: string, args?: string[], env?: Record<string, string> }`

  Both shapes simultaneously is an error; neither is an error;
  type mismatches on optional fields (e.g. `headers` not a
  string-to-string map) is an error.

The engine calls both before any write. UI code can also call
them directly to give live form-validation feedback.

```ts
type McpTransportConfig =
  | { url: string; headers?: Record<string, string> }
  | { command: string; args?: string[]; env?: Record<string, string> };
```

### `addCustomServer`

```ts
async addCustomServer(
  name: string,
  config: McpServerConfig
): Promise<ToolsMutationResult>;
```

1. Validate name + transport.
2. Read by name; reject as `{ field: "name", message: "Server already registered: <name>" }` if it exists.
3. `storage.mcpServers.create(name, config)`.

### `updateCustomServer`

```ts
async updateCustomServer(
  name: string,
  config: McpServerConfig
): Promise<ToolsMutationResult>;
```

1. Validate transport (name doesn't change, no name validation).
2. Read by name; reject as `{ field: "name", message: "Server not registered: <name>" }` if missing.
3. `storage.mcpServers.update(name, config)`.

### `removeCustomServer`

```ts
async removeCustomServer(name: string): Promise<void>;
```

`storage.mcpServers.delete` is idempotent — calling on a missing
name is a no-op, no error. Doesn't touch `toolPrefs`: disabled /
auto-approved entries for tools from the removed server become
inert (the live tool system never calls them) and can be cleaned
up lazily next time the panel opens.

### `getCustomServer` / `listCustomServers`

```ts
async getCustomServer(name: string): Promise<McpServerConfig | null>;
async listCustomServers(): Promise<Record<string, McpServerConfig>>;
```

Direct passthroughs.

### `replaceAllCustomServers`

```ts
async replaceAllCustomServers(
  map: Record<string, McpServerConfig>
): Promise<ToolsBulkResult>;
```

```ts
type ToolsBulkResult =
  | { success: true }
  | { success: false; errors: Array<{ name: string; error: TErrorData }> };
```

Validates every entry first; writes nothing if any entry fails so
the registry never observes a half-imported state. On success,
calls `storage.mcpServers.replaceAll(map)` for a single
backend round-trip.

Used for import / restore flows.

---

## Tool prefs — disabled

The disabled-tools map is keyed by *server type* (a custom MCP
server name, the literal `"web-search"` / `"image-generation"`,
or a host-tool group id). Values are arrays of tool names within
that server the user has turned off; tools not in the map are
enabled.

### `setDisabled`

```ts
async setDisabled(serverType: string, toolNames: string[]): Promise<void>;
```

Atomic update of one server's disabled list:

1. Read full disabled map.
2. Replace the entry for `serverType` (or remove the key entirely
   when `toolNames.length === 0`).
3. Single `storage.toolPrefs.upsertDisabled(next)` call.

### `getDisabled`

```ts
async getDisabled(): Promise<Record<string, string[]>>;
```

Direct passthrough.

### `isToolDisabled`

```ts
async isToolDisabled(serverType: string, toolName: string): Promise<boolean>;
```

Read the map and check membership. Convenience wrapper used by
the tool runner.

---

## Tool prefs — auto-approved

The auto-approve list is a flat array of `${serverType}_${toolName}`
tokens. The `_` separator is why server names can't contain `_`
(see [validation](#validation)).

### `setAllowAlways`

```ts
async setAllowAlways(
  serverType: string,
  toolName: string,
  value: boolean
): Promise<void>;
```

Adds or removes the token from the list. Idempotent — toggling
a token that's already in the desired state is a no-op (no write
either, the engine short-circuits on read).

### `getAllowAlways`

```ts
async getAllowAlways(): Promise<string[]>;
```

Direct passthrough — returns the raw list of tokens.

### `isAllowAlways`

```ts
async isAllowAlways(serverType: string, toolName: string): Promise<boolean>;
```

Convenience wrapper. The tool runner asks this when deciding
whether to skip the per-call approval dialog.

---

## Persistence semantics — at a glance

| Trigger                                              | Storage write                                                |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `addCustomServer`, success                           | `mcpServers.create(name, config)`                            |
| `addCustomServer`, validation / dup failure          | *no write*                                                   |
| `updateCustomServer`, success                        | `mcpServers.update(name, config)`                            |
| `updateCustomServer`, validation / missing failure   | *no write*                                                   |
| `removeCustomServer`                                 | `mcpServers.delete(name)` (no-op if missing)                 |
| `replaceAllCustomServers`, success                   | `mcpServers.replaceAll(map)` — single round-trip             |
| `replaceAllCustomServers`, failure                   | *no write*                                                   |
| `setDisabled` (with names)                           | `toolPrefs.upsertDisabled({ ...current, [type]: names })`    |
| `setDisabled` (with `[]`)                            | `toolPrefs.upsertDisabled(currentMinusType)`                 |
| `setAllowAlways(true)`, token already present        | *no write*                                                   |
| `setAllowAlways(true)`, token absent                 | `toolPrefs.upsertAllowAlways([...current, token])`           |
| `setAllowAlways(false)`, token absent                | *no write*                                                   |
| `setAllowAlways(false)`, token present               | `toolPrefs.upsertAllowAlways(currentWithoutToken)`           |
| Read methods                                         | *no write*                                                   |

The two `upsert*` methods on `ToolPrefsStorage` are the same
pattern as `AssignmentsStorage.upsertMany` — they replace the
explicit-`create`-then-`update` branching with a single
idempotent call so the engine doesn't have to know whether the
row has been written before.

---

## Internal helpers

| File                                                                             | Exports                                | Role |
| -------------------------------------------------------------------------------- | -------------------------------------- | ---- |
| [`engine.ts`](../../../src/core/services/tools/engine.ts)                         | `ToolsEngine`                          | Public class |
| [`validation.ts`](../../../src/core/services/tools/validation.ts)                 | `validateServerName`, `validateTransportConfig` | Pure predicates — also exported from the engine module for live form validation |
| [`types.ts`](../../../src/core/services/tools/types.ts)                           | `ToolsEngineDeps`, `ToolsMutationResult`, `ToolsBulkResult`, `McpTransportConfig`, `McpServerConfig` | Type definitions |
| [`index.ts`](../../../src/core/services/tools/index.ts)                           | barrel                                 | Re-exports |

---

## Designing on top of `ToolsEngine`

- **Settings UI for MCP servers** — `addCustomServer` /
  `updateCustomServer` / `removeCustomServer`. Pipe the
  `error.field` straight into your form-error state; the
  validation predicates are also exported so you can wire live
  client-side validation on the input fields.
- **"Import bundle" / "Restore from JSON"** —
  `replaceAllCustomServers`. The all-or-nothing behaviour means
  a corrupt bundle never partially overwrites the user's
  registry.
- **Tool runner deciding whether to call a tool** —
  `isToolDisabled` and `isAllowAlways`. Cache reads if you call
  them in a hot loop (e.g. before every tool dispatch).
- **"Approve always" checkbox in the tool-call dialog** —
  `setAllowAlways(serverType, toolName, true)`.
- **Bulk reset** — `setDisabled(type, [])` clears the entry for
  one server; for the full table, fall through to
  `storage.toolPrefs.deleteDisabled` directly. The engine
  intentionally doesn't expose a "wipe everything" method
  because that's a destructive admin op, not a routine user
  action.

When you find yourself reaching past the engine into
`storage.mcpServers` or `storage.toolPrefs` directly, ask whether
the rule you'd be bypassing belongs in the engine instead.
