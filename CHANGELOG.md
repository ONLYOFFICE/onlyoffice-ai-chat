# Changelog

## 0.4.38

- New built-in provider `"external"`. It has no SDK and no transport of its own — every HTTP call is delegated to a new `PlatformAdapter.externalFetch` hook, while response parsing is reused from an existing provider selected via the new `Profile.basedOn` field. The widget bridges `platform.externalFetch` into the engine alongside `fetchProxy`; the engine wires it into `ProviderCredentials.fetch` for every request from a `providerType: "external"` profile (independent of the `useProxy` flag). Currently only `basedOn: "openai"` is implemented — other reserved values throw a clear error at request time. Hosts use this when they want to own authentication / routing / the network call entirely, but still reuse the library's stream and tool-call parsing. `basedOn` lives in the type only — no UI changes.

```ts
const platform: PlatformAdapter = {
  // ...
  externalFetch: async (url, init) => myHostClient.proxiedFetch(url, init),
};

await api.profiles.add({
  name: "Hosted GPT",
  providerType: "external",
  basedOn: "openai",
  baseUrl: "https://api.openai.com/v1",
  modelId: "gpt-4o-mini",
  key: "sk-...",
});
```

## 0.4.37

- GET requests now serialize positional arguments as named query-string params. `RouteSpec` gains an optional `params: readonly string[]`; the fetcher maps `args[i]` → `params[i]=value` in the URL. Previously every GET silently dropped its arguments, so `api.threads.readMessages(threadId)` hit the backend without `threadId` and got an empty list — clicking a thread in `<ChatList />` rendered a blank chat. All GET routes in `core/services/*/types.ts` now declare their param names (`threads/read-messages` → `[threadId, limit, startIndex]`, etc.). `undefined`, `null`, and `""` values are omitted from the URL. Backends need to read these from the query string.
- DropdownMenu content now renders at `z-index: 400`, above the dialog and its overlay (300). Hosts that mount the dropdown inside a modal no longer see it clipped behind the overlay.

## 0.4.32

- Thread switching now loads messages deterministically. `onSwitchToThread(id)` calls `fetchPrevMessages(id)` directly instead of relying solely on the reactive `useEffect([threadId])` in `useMessages`. Custom routers that unmount `<ChatPage />` while showing `<ChatList />` and remount it on switch left no `useMessages` subscriber between transitions, so the new thread's history never loaded. `onSwitchToNewThread` likewise clears `messages` and resets the claim id synchronously. The reactive effect stays as a safety net; its claim check short-circuits the redundant fetch.

## 0.4.31

- Headless `router.currentPage` now reflects the initial-setup screen. When the chat page mounts without configured profiles it renders `<InitialSetup />` inline; previously `currentPage` stayed `"chat"`, so headless hosts reading `useRouter()` / `ref.getCurrentPage()` saw the wrong page. The Thread component now syncs the router: `"chat"` → `"initial-setup"` when profiles are missing, and back to `"chat"` once profiles appear. Explicit `"settings"` / `"history"` navigation is left alone.
- Docs: aligned `CLAUDE.md`, root `README.md`, `src/README.md`, and the full `docs/` tree with the actual source. Fixes counts (41 locales, 9 engines, 11 storage sub-stores, 2 tool sources), renames stale `*Service` references to `*Engine` (incl. `ChatEngine` → `AIEngine`), restores the real `src/` layout (`core/` + `ui/` + `shared/`), corrects subpath imports against `package.json#exports`, and drops links to non-existent doc files.

## 0.4.30

- New `onReady` callback in `ChatCallbacks`. Fires once per widget lifetime as soon as the profiles store has finished its first `init()` (regardless of which page is showing). Payload: `{ hasProfiles, currentProfileId, entityId }`. Hosts can stop polling / timing out and just register the callback to know when it's safe to send messages or forward attachments.
- New `PlatformAdapter.copyToClipboard?: (text) => void | Promise<void>` hook. When provided, every in-chat "Copy" action — user message copy, assistant message copy, code-block copy — delegates to it instead of calling `navigator.clipboard.writeText` directly. Required in cross-origin iframes / native WebView hosts where the Clipboard API is unavailable. When absent, behavior is unchanged (assistant copy continues to use `ActionBarPrimitive.Copy`).
- New per-profile `useProxy?: boolean` flag on `Profile`. When set, every request the underlying provider makes — chat completions, regeneration, tool-result resume, title generation, custom-prompt action, image generation — is routed through `PlatformAdapter.fetchProxy` instead of the global `fetch`. `ProviderCredentials` gains a matching `fetch?: ProviderFetch` field that the engine populates per request; SDK clients (OpenAI / Anthropic / GenAI / Mistral) and the raw-fetch providers (Together / OpenRouter / StabilityAI / OnlyOffice) all honor it. Flag is set programmatically — no UI changes.

```ts
<AIChatWidget
  callbacks={{
    onReady({ hasProfiles, currentProfileId }) {
      if (!hasProfiles) return; // widget will show InitialSetup
      sendQueuedMessages(currentProfileId);
    },
  }}
/>
```

## 0.4.29

- SSR fix: the markdown subtree is now loaded lazily, so importing `@onlyoffice/ai-chat` no longer throws `document is not defined` during Next.js / RSC server rendering. `MarkdownText` and `MarkdownContent` wrap their bodies in `React.lazy` + `Suspense` and short-circuit to `null` when `typeof document === "undefined"`.
- Heavy deps (`react-markdown`, `@assistant-ui/react-markdown`, `remark-gfm`, `decode-named-character-reference`) now live in a separate chunk and only download on the client. Main entry chunk shrunk from ~689 kB to ~399 kB.
- Chat page no longer flashes the `InitialSetup` screen while profiles are loading. New `initialized` flag on the profiles store flips to `true` only after the first `init()` resolves; the chat page renders a neutral background placeholder until then, then decides between `InitialSetup` (no profiles) and the chat surface.
- In-chat model switcher now actually changes the model used for the request. Previously the composer's `sessionChatProfile` was UI-only — `sendWithStream` / `regenerateStream` / `approve|denyToolCall` all resolved the profile via `assignments.resolveForAction(Chat)`, so requests kept going to the persisted Chat assignment. `SendStreamInput` / `RegenerateStreamInput` / `ToolCallData` now carry an optional `profileId`; when set, the engine loads that profile directly from `storage.profiles` and falls back to the assignment if the id is missing. The chat UI forwards `currentProfile.id` on every send / regenerate / tool approve / tool deny.

## 0.4.28

- Public API: re-export composite UI building blocks so hosts can assemble a custom layout without forking. New named exports from `@onlyoffice/ai-chat`:
  - Layout: `Layout`, `Navigation`, `ChatList`, `ChatListItem`, `DeleteChatDialog`.
  - Chat parts: `Composer`, `ThreadWelcome`, `UserMessage`, `AssistantMessage`.
  - Model: `ModelCard`, `DeleteProfileDialog`, `AddModelCard`, `EditModelCard`, type `ModelFormValues`.
  - Tools/files: `ManageToolDialog`, `ToolFallback`, `FileItem`.
  - Markdown: `MarkdownText`, `MarkdownContent`.
  - Misc: `ProviderLogo`, `SyntaxHighlighter` + `HighlighterProps`.
- Primitive components (Button, Input, Dialog primitives, …) are intentionally **not** re-exported — keep swapping them via `ComponentsProvider`.

```ts
import { Layout, Navigation, ChatList, Composer } from "@onlyoffice/ai-chat";
```

## 0.4.27

- AI errors are now serializable across the wire. When a provider call fails inside `sendWithStream` / `regenerateStream` / `approveToolCall` / `denyToolCall`, the engine emits `message-incomplete` with `status.error: ChatErrorPayload` — a plain `{ code, message, cause? }` object — instead of a raw `Error`. Previously hosts that serialized events via stock `JSON.stringify` lost the message and stack (non-enumerable on `Error`), so the browser received `{}` and the chat surface rendered `[object Object]`.
- New: `toChatError(err): ChatErrorPayload` (exported from `@onlyoffice/ai-chat` and `@onlyoffice/ai-chat/services`). Maps OpenAI / Anthropic / GenAI SDK errors to canonical codes: `auth`, `model_not_found`, `rate_limit`, `timeout`, `network`, `bad_request`, `server`, `not_found`, `aborted`, `unknown`. Applied in every provider's `createErrorResponse` / `createErrorResult` factory.
- UI: `MessageError` in the chat surface now reads the typed payload, looks up a localized string for the whitelist of known codes (`ChatError.auth`, `ChatError.model_not_found`, `ChatError.rate_limit`, `ChatError.timeout`, `ChatError.network`, `ChatError.aborted`), and falls back to `payload.message` otherwise. Code chip is shown below the message so support can quote it. Defensive against stale plain-object / string payloads from older hosts.
- `useMessages.onStreamError` callback now extracts `error.message` from the payload instead of doing `String(error)` — no more `[object Object]` in the JS callback path either.
- Tests: +13 (`toChatError`: 12 cases covering each origin classifier + JSON round-trip + idempotency; OpenAI 401 → `auth` mapping; UI banner renders localized text for known code, fallback message for unknown code, no `[object Object]` for legacy plain objects). Updated 4 provider factory tests for the new payload shape.

## 0.4.26

- `ApiProvider`: streaming routes (`sendWithStream`, `regenerateStream`, `approveToolCall`, `denyToolCall`) now actually stream over HTTP. The remote branch in `callRoute` previously did `fetch(...).then(res => res.json())` and cast the buffered result to the engine's `AsyncGenerator` type — `for await` on the returned promise threw `stream is not async iterable`. The remote branch now reads the response body as NDJSON (`application/x-ndjson`, one `ChatEvent` per `\n`-terminated line) and returns an `AsyncIterable` that `processStream` consumes chunk-by-chunk. In-process mode is unchanged.
- Wire format: one JSON event per line, no SSE `data:` prefix, no terminator. Non-2xx responses throw on the first iteration; mid-stream JSON parse failures throw and are caught by `processStream`'s existing `try/catch`.
- Hosts that proxy these four routes must switch their response from buffered JSON to NDJSON (`Content-Type: application/x-ndjson; charset=utf-8`, flushed per event, no proxy buffering). See `docs/ui/providers/api.md` for the contract.
- Tests: +7 fetcher cases (chunked NDJSON, split-across-boundaries buffering, trailing-no-newline event, empty stream, blank-line ignore, non-2xx error, non-streaming sibling on the same service still parses as JSON).

## 0.4.25

- Model list lookup in the "add provider" form now routes through the host API instead of calling the provider API directly from the browser. When `apiConfig` (core proxy) is configured on `AIChatWidget`, the request hits `POST <baseUrl>/profiles/list-provider-models` on the host; without it, the call still resolves locally via the engine — same behavior as before for embedded consumers.
- `ProfilesEngine.listProviderModels({ providerType, baseUrl, apiKey }): Promise<Model[]>` — new method that takes raw creds (no stored profile required). Existing `listModels(profileId)` is untouched.
- `DEFAULT_PROFILES_ROUTES.listProviderModels` — new `POST profiles/list-provider-models` route; `ApiProvider.profiles` forwards it. Hosts that proxy the engine over HTTP must implement this endpoint.
- `useModelForm` switched from a direct `provider.getProviderModels(...)` call to `api.profiles.listProviderModels(...)`.

## 0.4.24

- Attachments `linkToMessage` now lands on the backend as **one round trip**. Previously the engine bound N draft attachments via `Promise.allSettled` of N individual `storage.attachments.update` calls — one HTTP PATCH per attachment even though every record received the same `{messageId, threadId}` patch. Sending a five-file message meant five PATCHes after the user pressed Send.
- `AttachmentsStorage.updateManyByIds(ids[], patch): Promise<void>` — new interface method (sample `IDBAttachments` writes the batch in one IndexedDB transaction). Missing ids are silently skipped, matching the prior best-effort semantics.
- Engine `linkToMessage` calls `updateManyByIds` once. Same observable behavior, dramatically fewer round trips when storage is remote.
- Tests: +2 (engine round-trip count, empty-ids no-op).

## 0.4.23

- Attachments batch upload now lands on the backend as **one round trip**. Previously the UI store fanned an `Input[]` into N parallel `saveFile` calls, each of which became its own `storage.attachments.create` and its own HTTP POST — five dropped files meant five round trips even though the C# backend's `CreateManyAsync(EntryIds[])` accepts the whole list at once.
- `AttachmentsStorage.createMany(inputs[]): Promise<Attachment[]>` — new interface method (sample `IDBAttachments` writes the batch in one IndexedDB transaction).
- `AttachmentsEngine.saveFilesMany(inputs[], entityId?)` and `saveImagesMany(inputs[], entityId?)` — batch APIs that call `storage.createMany` once. Single `saveFile` / `saveImage` are kept for backwards compatibility and now delegate through the `Many` variant.
- `DEFAULT_ATTACHMENTS_ROUTES.saveFilesMany` / `saveImagesMany` — new POST routes; `ApiProvider.attachments` forwards them.
- UI store (`addAttachmentFile`/`addAttachmentImage`) calls the batch variant on every invocation. Limit (5) is still applied atomically inside the queue; surplus inputs are silently dropped before the network call.
- Tests: +8 (engine batch round-trip + delegation + array truncation in the store).

## 0.4.22

- OpenAI: added a second send-path through the Responses API (`/v1/responses`). Required for gpt-5+ reasoning models that reject `reasoning_effort` together with `tools` on `/v1/chat/completions` ("Function tools with reasoning_effort are not supported... Please use /v1/responses instead"). Routing is decided by a live `useResponsesApi` probe stored on `Profile`, probed at create time and whenever `modelId` / `providerType` / `baseUrl` change — mirrors the existing `canUseTool` probe.
- Provider API: `AbstractBaseProvider.checkResponsesApi(modelId, signal): Promise<boolean>` — default `false`. Only `OpenAIProvider` overrides it; all 11 third-party OpenAI-compatible subclasses (Together, OpenRouter, Groq, xAI, OnlyOffice, LM Studio, DeepSeek, Zhipu, Ollama, GPT4All, OpenAICompatible) inherit the default and never issue a probe.
- New `SendMessageArgs.useResponsesApi?: boolean`. Action layer reads `profile.useResponsesApi` and forwards the flag — providers that don't implement the path ignore it.
- New modules: `src/core/services/profiles/probe-responses.ts`, `src/core/providers/openai/responses-messages.ts` (input + tools converter — `input_text` / `input_image` / `input_file`, `function_call` + `function_call_output` items, reasoning parts from history dropped), `src/core/providers/openai/responses-stream.ts` (`processResponsesStream` — routes function-call args by `item_id`, finalizes reasoning before text/tools, mirrors `processStream` snapshot shape).
- Tests: +39 cases — probe-responses (6), responses-messages (15), responses-stream (7), openai branching + `checkResponsesApi` (8), engine probe wiring (3).

```ts
// Branching is invisible to chat callers — Profile carries the flag.
// gpt-5.5 profile: useResponsesApi=true after probe → /v1/responses
// gpt-4o profile:  useResponsesApi=true after probe → /v1/responses (works too)
// Together profile: useResponsesApi=false (default)  → /v1/chat/completions
```

## 0.4.21

- Attachments: `addAttachmentFile` / `addAttachmentImage` now accept `Input | Input[]`. Batch form runs `saveFile` / `saveImage` in parallel via `Promise.all`, applies the 5-item cap atomically (extras silently dropped), and commits all refs in a single `set`. Single-input callers are unchanged.
- Composer: DnD (`useChatDropAttachments`), local file picker (`selectLocalFile`), and image picker (`handleImageSelect`) now read all selected files in parallel and hand the whole batch to the store in one call instead of `await`-ing per file.

```ts
// single (unchanged)
await addAttachmentFile({ path: "a.txt", content, type: 0 });
// batch (new)
await addAttachmentFile([
  { path: "a.txt", content: c1, type: 0 },
  { path: "b.md",  content: c2, type: 0 },
]);
```

## 0.4.20

- Attachments: `resolveAttachmentRefs` now indexes `readManyByIds` results by `rec.id` instead of by position, so storage implementations may return records in any order or omit missing ids entirely. Interface contract for `AttachmentsStorage.readManyByIds` relaxed accordingly.

## 0.4.19

- MCP servers: `CustomServers.getServerType` now resolves a tool-call by looking up the tool name in `this.tools[serverType]` first (MCP servers expose tool names verbatim, with no server-name prefix), and only falls back to prefix-matching the configured keys if no live tool list claims it. Without this, every tool call from an MCP-sourced tool (HTTP or STDIO) ended up routed with `serverType === ""` and crashed with `"MCP server  is not running"`.

## 0.4.18

- Chat: rolled back the `waitUntilCustomServersReady` block in `onNew`/`regenerate` — it was correlated with a blank-screen regression in the host. Kept the cheaper `await useServersStore.getState().getTools()` refresh + fresh read of `tools` from the store right before the provider call, which still closes the React-commit-lag race without introducing a blocking await. `CustomServers.waitUntilReady` is still exported on the facade for opt-in use.

## 0.4.17

- MCP servers: `CustomServers.waitUntilReady(timeoutMs = 3000)` — event-driven wait (via `tools-changed`) that resolves once every configured server has either delivered its `tools/list` response or transitioned to `stopped`. `Servers.waitUntilCustomServersReady` exposes it on the facade.
- Chat: `onNew` and `regenerate` now `await waitUntilCustomServersReady(3000)` after publishing the user message but before calling the provider, then read `tools` fresh from the store. This closes the race where a user opens a chat and sends a message faster than the MCP handshake completes, which previously shipped an empty `tools` array to the provider. `isStreamRunning` is set early so the "Analyzing" indicator covers the bridge window.

## 0.4.16

- **Breaking (internal):** `useServersStore.initServers` is now `() => Promise<void>` (was sync). It re-reads the persisted MCP config from `api.tools.listCustomServers(entityId)` and pushes it into the in-memory `customServers` map before calling `startCustomServers`. Fixes the cross-instance case where a chat widget mount, separate from the settings widget that saved the config, would run with an empty `customServers` map and never send MCP tools to the provider. `reload` does the same.

## 0.4.15

- MCP servers: more diagnostic logging — `[mcp] buildToolsList grouped`/`result` to see what `ctx.servers.getTools()` returns and what ends up in the flat tools list; `[mcp] onNew sending message` to see what's actually passed to the provider when the user sends a message.

## 0.4.14

- MCP servers: `saveConfig` now calls `ctx.servers.startCustomServers()` right after `setCustomServers`, so freshly added STDIO/HTTP servers are actually spawned instead of sitting in pending until the page is reloaded.

## 0.4.13

- MCP servers: diagnostic logging (`[mcp] …`) across `setCustomServers`, `startCustomServers`, `startStdioServer`, `startHttpServer`, `initCustomServer`, and `onProcess` — to pinpoint why STDIO servers stay pending (config not delivered, `createProcess` returns null, init responses unparseable, etc.). To be removed once the integration is verified.

## 0.4.12

- Chat: also hide "Analyzing…" while the last assistant message has an unresolved tool-call (`result === undefined`). Adapter-sourced tools are executed in-engine and never surface a `tool-call-pending` event to the UI, so the store-level `isToolPending` flag missed them — the derived check from message content covers both paths. Diagnostic logging removed.

## 0.4.9

- Chat: new `isToolPending` flag in the message store gates the "Analyzing…" indicator. While any tool call is executing it stays hidden; after the tool finishes a 300ms grace window holds the gate, then the indicator surfaces only if the model's next chunk hasn't started yet. The tool's own spinner is the sole loading affordance during tool execution.

## 0.4.8

- Chat: hide "Analyzing…" entirely during the gap between a tool call completing and the first chunk of the model's continuation — only the tool's own spinner is shown. The indicator surfaces again only after the model has started streaming and goes idle for 300ms mid-stream.

## 0.4.7

- Chat: don't flash "Analyzing…" between a tool call completing and the next model chunk — on continuation the indicator stays hidden for a 300ms grace window, so only the tool's own loader is visible during execution.

## 0.4.6

- MCP config dialog: await `getConfig()` so saved servers actually load into the editor.
- MCP config dialog: default empty state now shows `{ "mcpServers": {} }` instead of `{}` (with `?? {}` fallback when the storage adapter returns `undefined`), so the JSON is valid out of the box.

## 0.4.4

**Breaking** `ToolsAdapter` reshaped:

- `getTools(entityId?, config?)` — receives the active `entityId`
  and `config.attachmentId` (de-duplicated attachment ref ids
  collected from every message of the current request). Lets the
  adapter scope tools per room and surface attachment-specific
  tools (e.g. PDF parser when a PDF is attached).
- `callTool(name, args, entityId?)` — receives the active
  `entityId` for per-room execution routing.
- `denyTool` removed. The engine resumes with `"User deny tool
  call"` itself; the hook had no callers.

```ts
const adapter: ToolsAdapter = {
  async getTools(entityId, { attachmentId } = { attachmentId: [] }) {
    return attachmentId.length
      ? { pdf: [pdfParserTool] }
      : { default: [echoTool] };
  },
  async callTool(name, args, entityId) {
    /* … */
  },
};
```

## 0.4.3

- New `onProfileImportClick` prop on `AIChatWidget` — host handler
  for the "Import" link in the add-profile card. When provided, the
  widget calls `preventDefault` and delegates the click. When omitted,
  the link stays inert (existing behavior).

```tsx
<AIChatWidget onProfileImportClick={() => openMyImportDialog()} />
```

## 0.4.2

- New `composerActions` prop on `AIChatWidget` — inject custom
  onClick-only items into the composer's `+` (attachments) dropdown,
  rendered above the built-in Web Search / Extended Thinking block.
  Each item is `{ id, text, icon?, onClick }`; `icon` accepts an
  `IconName`, a custom registered icon name, or a React node.
- The composer's `+` dropdown no longer renders a leading separator
  when there are no attachment items above it (e.g. when `platform.file`
  is absent and no `composerActions` are passed).
- Removed the icon from the "Code" row in the model assignment page
  to match the rest of the assignment fields.

```tsx
<AIChatWidget
  composerActions={[
    { id: "snippets", text: "Snippets", icon: "btn-copy", onClick: openSnippets },
  ]}
/>
```

- `AssignmentsStorage` write methods (`create`, `update`, `delete`,
  `upsertMany`, `deleteMany`) now accept an optional opaque `entityId`
  parameter, matching `readByType`. Lets adapters scope assignment
  writes per entity ("room") — for example, a per-room Chat profile
  alongside the globally assigned one. Existing call sites are
  unaffected since the parameter is optional.
- Fixes the same role-grouping bug from 0.4.1 on the error path:
  `message-incomplete` events now carry a stable id (reused from
  prior stream deltas, or freshly minted when the error is the first
  event). Failed messages remain non-persisted by design.

## 0.4.1

- Fixes a thread-rendering bug where messages got grouped by role
  (all assistants, then all users) after switching threads or while
  streaming. Root cause: in-flight messages reached the assistant-ui
  runtime without an `id`, forcing it onto an index-based fallback
  that produced phantom branches in the message tree.
- New `user-message-stored` event in `ChatEvent`, yielded by
  `AIEngine.sendWithStream` once storage has persisted the user
  message and before the assistant stream starts. Carries the
  storage-assigned `id` and `createdAt`. The built-in UI uses it
  instead of an optimistic placeholder so the runtime always sees a
  fully-identified message.
- `processStream` now stamps the storage-assigned `id` onto every
  in-flight message before emitting `message-start` / `message-delta`
  / `message-end` / `tool-call-pending`, so streaming assistant
  messages also carry a stable id from the first chunk.
- `ThreadsEngine.appendUserMessage` now returns the persisted
  `ThreadMessageLike` (the `id` is on the returned object). Update
  call sites that read the previous string return value.

## 0.4.0

**Breaking** `PromptsStorage.createMany` and
`PromptFoldersStorage.createMany` now match the `ProfilesStorage.createMany`
shape — they accept `Omit<T, "id" | "createdAt" | "updatedAt">[]` and
return the persisted records with storage-assigned ids.

Why: the previous contract required storage to honor caller-supplied
ids, which only works for client-authoritative backends (IndexedDB).
HTTP-backed storage cannot accept arbitrary ids without a server-side
`INSERT … WITH ID` endpoint, breaking import-bundle round-trips. The
new contract is storage-agnostic.

Migration:

- Custom storage implementations: drop incoming `id` / `createdAt` /
  `updatedAt`, generate fresh ones, return the persisted array in
  input order.
- Hosts calling `importBundle({ mode: "merge" })`: bundle ids are no
  longer used as the merge key — folders match by `name`, prompts by
  `(name, folderId)`. If your bundles relied on id stability, switch
  to `mode: "replace"`.

`importBundle` engine-side: now remaps `folderId` references using the
returned folder ids. Round-trip `export → importBundle` works through
any storage.

```ts
// before
createMany(prompts: Prompt[]): Promise<void>;
// after
createMany(
  prompts: Omit<Prompt, "id" | "createdAt" | "updatedAt">[]
): Promise<Prompt[]>;
```

## 0.3.3

- Re-export `RegenerateStreamInput` from `@onlyoffice/ai-chat` (via
  `core/services/ai` and `core/services` barrels). Fixes asymmetry with
  the other `*Input` types for public `AIEngine` methods — hosts no
  longer need `Parameters<AIEngine["regenerateStream"]>[0]` to type the
  controller payload.

```ts
import type { RegenerateStreamInput } from "@onlyoffice/ai-chat";
```

## 0.3.2

Re-roll the last assistant reply with one click. The built-in action bar
under every assistant message now ships a Regenerate button next to Copy
and Save; under the hood the `useExternalStoreRuntime` `onReload`
callback routes into a new engine method and a programmatic API on
`useMessages` for hosts that need to trigger it from their own UI.

- **New** `AIEngine.regenerateStream({ threadId, entityId?, actionArgs? })` —
  reads `storage.messages.readByThread`, deletes every trailing message
  after the last user message (covers tool-call hops + the old
  assistant reply via `storage.messages.delete`), then streams a fresh
  reply through the same `processStream` + `runChatStream` pipeline as
  `sendWithStream`. The user message itself is left untouched — its
  storage row, attachments and id stay intact. Default route:
  `POST ai/regenerate-stream`.
- **New** `useMessages().regenerate(parentIndex)` — the hook returns it
  alongside `onNew` / `approveToolCall` / `denyToolCall`. No-ops when a
  stream is already running, the parent isn't a user message, or
  there's no active thread.
- **New** `MessageStoreState.truncateMessagesAfter(index)` — drops every
  message after `index` from the in-memory store; used by the
  regenerate flow before the new stream lands.
- **New** built-in `ActionBarPrimitive.Reload` button in the assistant
  action bar (icon `btn-reset`, tooltip `t("Regenerate")`). Disabled
  during streaming and on `incomplete + error` states, identical to
  Copy / Save. Wired through `useExternalStoreRuntime.onReload` in
  `Thread`.
- i18n: new `Regenerate` key (en + ru); other locales fall back to en.

```tsx
const { regenerate } = useMessages({ isReady: true });
// re-roll the assistant reply that follows messages[parentIndex]
await regenerate(parentIndex);
```

## 0.3.1

Hosts can now append custom buttons to the action bar under every
assistant message — alongside the built-in Copy and Save — and route
the message text into their own flows (insert into doc, translate,
read aloud, send to a task tracker, …).

- **New** `AIChatWidgetProps.assistantActions?: AssistantAction[]` — also
  available on `WidgetConfig` for headless mounts. Each action gets
  `{ id, tooltip, icon, onClick, isVisible? }`. `icon` accepts a
  built-in `IconName`, a custom registered name (via `images`), or a
  React node. `onClick` receives `{ text, markdown, message }` and may
  be sync or async — thrown / rejected errors are logged, never
  surfaced.
- **New** `getMessageText(message)` utility — joins text parts of a
  `ThreadMessageLike` with `\n\n`, skips tool-call parts. Re-exported
  from the package root.
- Custom actions inherit the built-in visibility rules: hidden while
  streaming and on `incomplete + error` message status, identical to
  Copy / Save.

```tsx
<AIChatWidget
  assistantActions={[
    {
      id: "insert-into-doc",
      tooltip: "Insert into document",
      icon: "btn-copy",
      onClick: ({ text }) => host.insertText(text),
    },
  ]}
  ...props
/>
```

## 0.3.0

Attachments are now persisted in their own IndexedDB store and
referenced by id — composer drafts, persisted messages and
middleware all carry lightweight refs (`{id, title, kind, ...}`),
and core hydrates them inline only when the provider is about to
see the message. Threads with attachments load and re-stream
faster, and middleware no longer pulls megabytes of base64
through every hook.

- **New** `AttachmentsStorage` (`storage.attachments`) with
  `create`, `readManyByIds`, `update`, `delete`,
  `deleteByMessage`, `deleteByThread`. The IndexedDB schema
  bumps to `DB_VERSION = 3` to add the new store. Custom
  storage implementations must add an `attachments` field and
  cascade from `messages.delete` / `deleteByThread`.
- **New** `AttachmentsEngine` service —
  `saveFile / saveImage / get / getMany / delete / linkToMessage` —
  exposed through `api.attachments` so a server-hosted core can
  serve every call over HTTP via `DEFAULT_ATTACHMENTS_ROUTES`.
- **New** ref encoding for `ThreadMessageLike.content[]`:
  - File: `{type:"file", mimeType: JSON({ref, title, kind, path?, type?}), data:""}`
  - Image: `{type:"image", image: JSON({ref, title, kind}), name: title}`
- **New** `core/actions/attachment-resolution.ts` —
  `resolveAttachmentRefs` swaps refs for hydrated inline blocks
  before the provider is called. Legacy inline blocks pass
  through untouched (no migration required).
- **Breaking** middleware/callbacks contract:
  - `BeforeSendContext.files / .images` now `TAttachmentRef[]`
    (was `TAttachmentFile[]` / `TAttachmentImage[]`).
  - `BeforeSendContext.resolveAttachment(id)` added — call it
    when a middleware needs the raw payload.
  - `MessageSentEvent.attachments.files / .images` now
    `TAttachmentRef[]`.
- **Breaking** zustand attachments store: `addAttachmentFile` /
  `addAttachmentImage` are now async (write to storage first) and
  delete / clear cascade the storage delete. The composer button
  and DnD handler `await` the new signatures. Per-attachment
  ids replace `path` / `name` as the delete key.
- Composer file picker now caps imports at 5 (was off-by-one at
  6, despite the 5-item store limit).
- `useMessages` clears both `attachmentFiles` and
  `attachmentImages` on thread switch (images previously leaked
  across thread navigation).

```ts
// before — middleware sees full base64
beforeSend: async (ctx) => {
  for (const img of ctx.images) console.log(img.base64.length);
  return { action: "continue" };
}

// after — middleware sees refs, hydrates on demand
beforeSend: async (ctx) => {
  for (const ref of ctx.images) {
    const full = await ctx.resolveAttachment(ref.id);
    console.log(full?.base64?.length);
  }
  return { action: "continue" };
}
```

### Tool-calling fallback for non-function-calling models

- **New** `Profile.canUseTool?: boolean` — set by a live probe at
  profile create / update (when `modelId`, `providerType` or
  `baseUrl` change). The probe asks the model to call a fake tool
  and records whether it actually emitted a `tool-call`.
- **New** text-protocol fallback in every action: when
  `canUseTool === false`, history is sanitised
  (`tool-call` / `tool-result` parts → `<TOOL_CALL>{...}</TOOL_CALL>`
  and `<TOOL_RESULT>...</TOOL_RESULT>` plain text), the API request
  goes out without a `tools` field. For streaming actions
  (`chat`, `custom`) the tools description is also injected into
  the system prompt and the response stream is parsed by a
  state machine that turns the model's `<TOOL_CALL>` block into a
  synthetic `tool-call` content part — the rest of the
  approval / resume loop works unchanged. Broken JSON or an
  unclosed tag falls back to plain text.

```ts
// Local model without function-calling now still routes through tools:
//
//  user: "search the web for X"
//   →  systemPrompt += <tools listing + format rules>
//   →  model emits: <TOOL_CALL>{"name":"web_search","arguments":{"q":"X"}}</TOOL_CALL>
//   →  parsed → ManageToolDialog → execute → <TOOL_RESULT>... fed back
```

### `Code` assignment slot

- **New** `ActionType.Code` with `Chat` capability requirement —
  exposed in the Model Assignment page and wired through the
  profiles store (`codeProfile`, `setCodeProfile`,
  `ModelAssignmentTask = "code"`).
- **New** per-action fallback chain `ACTION_FALLBACKS`
  (`Code → Chat`) honoured by `tryResolveForAction`. When the
  `Code` slot is empty the resolver tries `Chat` (entity-scoped),
  then falls back to the global `Default`. Existing slots
  resolve straight to `Default` as before.

## 0.2.11

Perf: pages now declare their own data dependencies — opening
`AiModelsPage` no longer triggers tool/thread/prompt fetches that
the page doesn't need. In headless mode each page is fully
self-sufficient.

| Page | Hooks fired on mount |
|---|---|
| `ChatPage` | profiles + threads + prompts + tools |
| `Settings` | profiles |
| `AiModelsPage` | profiles |
| `ModelAssignmentPage` | profiles |
| `McpServersPage` | tools |
| `WebSearchPage` | — |

- New page-level hooks: `useEnsureProfiles`, `useEnsureThreads`,
  `useEnsurePrompts`, `useEnsureTools`. Each calls its store's
  `init` in a `useEffect` on mount and re-fires when the page
  remounts (so navigating away and back refreshes the data).
- `AIChatWidget` no longer calls `useProfiles` / `useThread` /
  `useServers` globally in `AppInner`. Render is gated on
  `isReady` so migration completes before any page-level fetch.
- The legacy `useProfiles` / `useThread` / `useServers` hooks
  remain exported for back-compat — but they are no longer used
  internally and you should prefer the per-page `useEnsureX`
  variants.

```tsx
// headless: each page handles its own init
{currentPage === "ai-models" && <AiModelsPage />}
{currentPage === "mcp-servers" && <McpServersPage />}
{currentPage === "chat" && <ChatPage />}
```

## 0.2.10

Perf: trimmed redundant work across the chat UI — store subscriptions
re-render only on the slice they read, the tool list updates locally
on toggle instead of refetching, and the bootstrap fan-out is one
round-trip instead of two.

- Replaced `const { a, b } = useXxxStore()` with per-field selectors
  in 20+ components (`Thread`, `Composer`, `AssistantMessage`,
  `UserMessage`, `ComposerActionPrompts`, `ComposerActionAttachments`,
  `ComposerActionServers`, `ComposerActionSelectModel`,
  `ManageToolDialog`, `useMessages`, all of `pages/mcp-servers/*`,
  `pages/ai-models`, `pages/model-assignment`, `pages/initial-setup`,
  `DeleteChatDialog`, `DeleteProfileDialog`, `FileItem`,
  `useChatDropAttachments`).
- `changeToolStatus` now flips the `enabled` flag in-place instead of
  re-running `buildToolsList` (no extra `api.tools.getDisabled` /
  `api.webSearch.isConfigured` / host `getTools` calls per click).
- `useServers` no longer polls every 5 minutes — `tools-changed`
  events drive refreshes. Initial mount calls `getTools` once
  instead of twice.
- `ProfilesService.init` now fans out `profiles.list`,
  `preferences.getDeepMode`, and `assignments.getAllAssignments` in
  one `Promise.all` (was 2 + 1 sequential).
- `AssistantMessage` is now wrapped in `React.memo`, so the
  per-token array recreation in the message store no longer
  cascades a re-render through every assistant bubble.
- `ComposerActionSelectModel` memoizes its filtered profile list
  and dropdown items so the auto-select effect doesn't re-fire on
  every parent render.

```ts
// before
const { servers, changeToolStatus } = useServersStore();
// after
const servers = useServersStore((s) => s.servers);
const changeToolStatus = useServersStore((s) => s.changeToolStatus);
```

Fix: `ActionType` is now exported from a single canonical source —
`shared/action-type` (8 values, including `Default`). The duplicate
truncated 7-value copies in `src/capabilities.ts` and
`src/core/capabilities.ts` re-export from there. Consumers of
`@onlyoffice/ai-chat` and `@onlyoffice/ai-chat/core` see the same
`ActionType.Default` member that `AssignmentsStorage` already relied
on internally.

Tests: 2206 across 211 files; coverage rose to 95.6% statements /
86.8% branches (from 94.5% / 85.2%) — added targeted tests around
`useMessages` stream branches, `HostToolSource` error paths,
`servers` accessors, and `changeToolStatus` optimistic update.

## 0.2.9

Fix: restore the missing padding on the initial-setup page so the
"AI Models" form no longer butts up against the left edge of the
chat surface — adds the same `mx-[32px] mt-[32px]` wrapper margin
used by `SettingsPage`.

Fix: web-search toggle inside the composer actually flips state.

- The composer dropdown was reaching into `servers["web-search"]` —
  but web-search is resolved engine-side per request and never
  populates the UI's `servers` aggregator, so the click handler was
  throwing on `servers["web-search"][0].name` and silently failing.
- Toggle now drives `disabledTools["web-search"]` directly with the
  built-in tool names (`web_search`, `web_crawling`); checked state
  reflects "configured AND at least one tool not disabled".

UX: model picker in the profile connection form is now sorted
alphabetically (case-insensitive `localeCompare`) so finding a
specific model in long catalogues (OpenAI, OpenRouter, etc.) doesn't
require scrolling through the provider's native ordering.

Fix: ONLYOFFICE-AI profiles can now be picked in Model Assignment.

- The ONLYOFFICE catalogue endpoint doesn't expose per-model
  capabilities, so models were emitted with `capabilities: undefined`
  → assignment validation rejected every ONLYOFFICE profile for
  "lacking capabilities" and the localStorage write never landed
  (the UI still updated optimistically, masking the silent failure).
- Defaulted ONLYOFFICE-AI models to `Chat | Vision | Tools`, the
  same broad fallback the generic OpenAI-compatible provider uses.

Fix: creating a prompt folder no longer creates two folders.

- The Save button in the "New AI prompt folder" dialog had its own
  `onClick={onSave}` *and* sat inside a `<form onSubmit>` — clicking
  Save fired `onSave` twice (once via `onClick`, once via the form's
  default submit). The Save button is now a plain `type="submit"`
  driven by the form, and Cancel is `type="button"` so it can't
  accidentally submit the form either.

Fix: hide the "Analyzing" indicator while a tool is executing.

- On `tool-call-pending` the request-busy flag is now held without
  arming the 300ms idle timer (`holdBusy()` instead of `markChunk()`)
  so the indicator stays suppressed until the model produces the
  next chunk in the resumed stream.

Fix: copy button on user messages now actually copies.

- Replace `ActionBarPrimitive.Copy` (which was wired to runtime
  `composer.isEditing` / `isCopied` state that doesn't always
  populate for user messages from `useExternalStoreRuntime`) with an
  explicit `navigator.clipboard.writeText` handler driven by local
  `copied` state — same UX (3-second checkmark feedback), but
  reliable for user-authored messages.

OpenRouter image generation now works (e.g. `openai/gpt-4o-image`,
`gpt-5-image`).

- `OpenRouterProvider.imageGeneration` overrides the default OpenAI
  path (`/images/generations`) — OpenRouter doesn't expose that
  endpoint. Goes through `/chat/completions` with
  `modalities: ["image", "text"]` instead and returns the base64 from
  the `message.images[0].image_url.url` data-URI.

Optional `displayName` for host tools and tool groups.

- New optional `HostTool.displayName` — custom label shown in the
  tools list UI; falls back to `name` when omitted. Never sent to
  the model.
- New optional propagation through `TMCPItem.displayName` so the
  field flows from `HostToolGroup` definitions to the UI.
- `HostToolGroup.name` is now actually used in the UI (was
  previously rendering the group `id` instead). New
  `Servers#getHostToolGroupDisplayName(groupId)` resolves it with a
  fallback to `id`.

```ts
const editorTools: HostToolGroup = {
  id: "desktop_editor",
  name: "Desktop Editor",
  tools: [
    {
      name: "insert_text",
      displayName: "Insert text",
      description: "Insert text at the current cursor position",
      inputSchema: { /* … */ },
      handler: async (args) => { /* … */ },
    },
  ],
};
```

## 0.2.8

`ThemeProvider` no longer leaks the scoped preflight onto its
`children`.

- The outer themed `<div>` is no longer the `aui-root` / portal
  container. A dedicated empty `<div className="aui-root" />` is
  rendered as a sibling of `children` and used as the Radix portal
  target.
- Result: in headless mode, host content wrapped in `<ThemeProvider>`
  is *not* hit by the reset; dialogs / dropdowns / tooltips still
  inherit the full preflight because they portal into the dedicated
  scope.

## 0.2.7

(skipped — superseded by 0.2.8 before publish.)

## 0.2.6

Scope Tailwind preflight to the widget — host pages are no longer
affected.

- New post-build step (`scripts/scope-preflight.mjs`) rewrites every
  selector inside `@layer base { ... }` in `dist/styles/index.css`
  with a `:where(.aui-root)` prefix; `html` / `:host` are remapped
  onto `:where(.aui-root)` itself so the same defaults cascade
  inside the widget. `:where()` keeps specificity at 0 so host CSS
  always wins.
- `aui-root` is auto-applied on `Layout`, every page root
  (`ChatPage`, `SettingsPage`, `AiModelsPage`, `ModelAssignmentPage`,
  `McpServersPage`, `WebSearchPage`, `EmptyScreenPage`, initial
  setup), and the `ThemeProvider` portal-container `<div>`.
- `DropdownMenu` now mounts inside `DropdownMenu.Portal` with
  `container={portalContainer}` so dropdowns inherit the scope —
  matches what `Tooltip` and `Dialog` already do.

## 0.2.5

Expose the server-API layer and headless action helper.

- Re-export from main entry: `ApiProvider`, `useApi`, `createServerAPI`,
  `DEFAULT_SERVER_API_ROUTES`, types `ServerAPI`, `ServerAPIConfig`,
  `ServerAPIEngines`, `ServerAPIRoutes`.
- Re-export `providerFor` + type `ActionArgs` for headless per-action
  execution against a resolved profile.
- New subpath `@onlyoffice/ai-chat/providers/ApiProvider` for direct
  imports / better tree-shaking.
- Docs: fix `Servers` constructor signature (`new Servers(platform,
  eventBus)`); drop `undefined as never` hacks in the standalone-page
  example now that the routes constant and factory are public.

```ts
import {
  ApiProvider, createServerAPI, DEFAULT_SERVER_API_ROUTES,
  type ServerAPIConfig,
} from "@onlyoffice/ai-chat";
```

## 0.2.4

Slim install: nearly every runtime dep moved to (optional) peer.

- `dependencies` now only ships `lodash.clonedeep`. Provider SDKs
  (`@anthropic-ai/sdk`, `@google/genai`, `@mistralai/mistralai`,
  `openai`) and every UI dep (Radix, framer-motion, codemirror,
  react-shiki, react-svg, react-i18next, i18next, zustand, …) are
  now optional peer dependencies — install only what you actually
  use.
- `react`, `react-dom`, `@assistant-ui/react`, `assistant-stream` are
  required peers.
- All `dependencies` / `peerDependencies` are now externalized in
  `vite.config.ts`; `dist/index.js` shrinks from ~3.5 MB to ~36 KB
  and `dist/core/*` only imports the four provider SDKs at runtime.
- Removed unused packages from `dependencies`:
  `@assistant-ui/react-ai-sdk`, `@lmstudio/sdk`,
  `@openrouter/ai-sdk-provider`, `ollama`, `together-ai`,
  `@radix-ui/react-avatar`, `@radix-ui/react-select`.
- Server-only consumers can now `npm i @onlyoffice/ai-chat` plus the
  provider SDK they target and skip the entire UI tree.

## 0.2.3

Internal refactor — platform module moved under providers folder.

- `src/ui/platform/` → `src/ui/providers/PlatformProvider/`. The
  public `@onlyoffice/ai-chat/platform` subpath import is unchanged.
- Docs: `PlatformProvider` listed in `ui/providers/README.md`,
  adapters reference updated.

## 0.2.2

Internal refactor — imperative module moved under providers folder.

- `src/ui/imperative/` → `src/ui/providers/ImperativeProvider/`.
  The public `@onlyoffice/ai-chat/imperative` subpath import is
  unchanged.
- Docs: `docs/ui/imperative.md` → `docs/ui/providers/imperative.md`,
  `ImperativeProvider` listed in `ui/providers/README.md`.

## 0.2.1

Internal refactor — events module moved under providers folder.

- `src/ui/events/` → `src/ui/providers/EventsProvider/`. The
  public `@onlyoffice/ai-chat/events` subpath import is unchanged.
- Docs: `docs/ui/events.md` → `docs/ui/providers/events.md`,
  `EventsProvider` listed in `ui/providers/README.md`.

## 0.2.0

Tool flow refactored — built-in tools execute server-side, user
tools dispatch client-side, allow-always state lives in storage.

- New optional `ToolsAdapter` widget prop (`getTools` / `callTool` /
  `denyTool`). Adapter-served and built-in (`web-search`,
  `image-generation`) tools are auto-executed in `runChatStream`
  without an approval dialog.
- `AIEngine.sendWithStream` now yields `ChatEvent` (was `SendResult`).
  `tool-call-pending` carries `autoAllow` from
  `storage.toolPrefs.allowAlways`.
- One-phase tool flow — `approveToolCall({ result, allowAlways? })`
  persists the result and resumes; `denyToolCall()` resumes with
  `"User deny tool call"`. `continueAfterToolCall` and
  `tool-call-executed` are gone.
- `WebSearchEngine.setActiveConfig(config)` — direct write without
  `testConnection`. Settings page now goes through `api.webSearch.*`,
  which fixes the divergence between UI cache and `storage.webSearch`.
- `Servers` (UI) shrunk to `hostToolSource` + `customServers`.
  `WebSearch` / `ImageGeneration` UI classes removed; sources moved
  to `core/services/web-search/source.ts` and
  `core/services/ai/sources/image-generation.ts`.
- `ToolDispatcher` interface and `createServersDispatcher` removed —
  the engine no longer needs a runtime dispatcher.
- `ToolsAdapter.getTools()` returns `Record<serverType, TMCPItem[]>`;
  the engine filters disabled tools per group instead of parsing
  prefixes.
- `runChatStream` now also wraps `approveToolCall` / `denyToolCall`
  resumes — adapter tools in follow-up rounds keep auto-executing.

| File / area | Change |
| --- | --- |
| `src/core/tools-adapter.ts` | New `ToolsAdapter` interface |
| `src/core/services/ai/tools.ts` | New — `buildToolContext`, `executeAdapterTool`, `resolveToolSource`, `mergeToolsByName` |
| `src/core/services/ai/sources/image-generation.ts` | New — `getImageGenerationTools`, `callImageGenerationTool` |
| `src/core/services/web-search/source.ts` | New — `getWebSearchTools`, `callWebSearchTool`, `WEB_SEARCH_TYPE` |
| `src/ui/tools/dispatcher.ts` | Removed |
| `src/ui/tools/sources/{WebSearch,ImageGeneration}.ts` | Removed |
| `samples/basic/src/adapters/toolsAdapter.ts` | New — example `ToolsAdapter` with two stub groups |

```ts
// New widget prop
<AIChatWidget
  storage={storage}
  toolsAdapter={toolsAdapter}
  /* … */
/>

// One-phase approve
const stream = api.ai.approveToolCall({
  threadId, messageId, idx, message,
  result,         // <-- caller-supplied
  allowAlways,    // <-- engine writes to storage.toolPrefs
  actionArgs: { isReasoning, tools },
});
```

## 0.1.22

- Fix infinite `fetchModels` loop in `EditModelCard` that exhausted the browser's network pool (`net::ERR_INSUFFICIENT_RESOURCES`). `fetchModels` in `useModelForm` is now memoized via `useCallback`, so the effect that seeds models on mount no longer re-fires on every render.

## 0.1.19

New host callbacks on `ChatCallbacks` (all optional):

- `onThreadsUpdated` — fires on any thread change (`created` / `switched` / `renamed` / `cleared` / `deleted`).
- `onProfilesUpdated` — fires on any profile inventory change (`created` / `updated` / `deleted`).
- `onProfileUpdated` — fires on `editProfile` (granular, previously missing).
- `onCurrentChatProfileUpdated` — fires when the effective chat profile changes, with `scope: "session" | "persisted"`.
- `onModelAssignmentUpdated` — fires on every task-slot assignment (`default`, `chat`, `summarization`, `translation`, `textAnalysis`, `imageGeneration`, `ocr`, `vision`).
- `onServersUpdated` — fires on MCP changes (`config-saved` / `server-deleted` / `tool-toggled` / `tool-auto-approve-changed`).
- `onWebSearchUpdated` — fires on every `setWebSearchData` (including disable).

New imperative methods on `AIChatWidgetRef` to re-sync in-memory state when the host mutates storage externally:

- `updateProfiles()` — re-reads the profile list.
- `updateThreads()` — re-reads the thread list.
- `updateCurrentChat()` — re-reads the persisted chat profile.
- `updateModelAssignment()` — re-reads `default` + 7 task profile assignments.
- `updateMCPServer()` — re-reads MCP config and rebuilds the tool list.
- `updateWebSearch()` — re-reads Web Search configuration.

New widget config flag:

- `isDialogFullscreen` — puts every built-in dialog into fullscreen mode. Per-call `<DialogContent isFullscreen>` still wins when explicitly set.

## 0.1.18

- `hideProfilePicker` — hides the `Ask <profile>` row in the composer.
- `hideSettingsButton` — hides the gear button in the header.
- `onSettingsClick` — fully overrides the settings button click (built-in toggle is skipped).
- `isSettingsActive` — forces the settings button active state (override for `currentPage === "settings"`).
- `DialogContent.isFullscreen` — renders the dialog at 100% of the portal container and hides the header close button.

All widget props live on `AIChatWidget`. In headless mode, the same flags are available via `WidgetConfigProvider`.

## 0.1.0

- Initial release: extracted from ONLYOFFICE AI Agent plugin
