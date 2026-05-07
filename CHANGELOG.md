# Changelog

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
