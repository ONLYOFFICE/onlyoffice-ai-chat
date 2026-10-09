# Changelog

## 1.0.1

### Fixed

- Coalesce streamed deltas so a long reasoning block can't freeze the editor. Every delta rendered synchronously; the store is now updated from a timer, at most once per 50 ms.
- Default the model form to the model the picker lists first, not the first one the API returned. The two orders could disagree, leaving an old snapshot selected while the newest model topped the list.
- Let the initial setup form fill the pane up to `--initial-setup-max-width`. It had shrunk to the width of its title, so the fields stopped halfway across the pane.
- Draw the ONLYOFFICE logo in the context cloud row at its native 16px instead of stretching it to the 24px icon slot.

## 1.0.0

First stable release of `@onlyoffice/ai-chat` — a headless AI chat widget with built-in providers, MCP tool support and pluggable adapters.

### Providers

- Built-in providers: OpenAI, Anthropic, Google Gemini, Mistral, xAI, DeepSeek, Groq, Together AI, OpenRouter, Zhipu, Stability AI, Ollama, LM Studio, GPT4All, a generic OpenAI-compatible provider and the ONLYOFFICE gateway.
- `"external"` provider: the host owns transport via `PlatformAdapter.externalFetch`, response parsing is reused from a provider picked by `Profile.basedOn` (`openai`, `anthropic`, `mistral`, `openrouter`).
- Custom providers registered at runtime; import link and `onDownloadTemplate` for host-supplied provider templates.
- Lazy provider registry — each SDK loads on demand (`createProvider` / `providerFor` are async).
- OpenAI Responses API transport, chosen per profile by a live `useResponsesApi` probe.
- Live `canUseTool` probe; text-protocol tool-calling fallback (`<tool_call>` blocks) for models without native function calling.
- Per-profile `useProxy`, global `forceProxy`, custom `Profile.headers`, keyless local endpoints.
- Image generation (OpenAI, OpenRouter, OpenAI-compatible) and one-shot actions: summarization, translation, OCR, vision, text analysis, custom prompt.
- Prompt caching, `x-session-id` and `metadata` source attribution (`SourceMeta`, `resolveSource`) on the ONLYOFFICE route; OpenRouter routing hints.
- Typed, serializable chat errors (`toChatError`, `ChatErrorPayload`) with localized messages and a Retry button.

### Extended thinking

- Provider-neutral `ReasoningLevel` (`off` / `low` / `medium` / `high` / `max`) mapped to each provider's knob and clamped to what the model accepts.
- `ReasoningSupport` per model (`thinks`, `canDisable`, `depths`), read from the OpenRouter / ONLYOFFICE catalogue when available; the composer's **Effort** row adapts to it.
- Thinking blocks rendered in the message; reasoning level persisted via `PreferencesEngine`.

### Tools & MCP

- MCP servers over Streamable HTTP (stateful sessions) and stdio, with runtime `tools/list_changed` support and `initialize` instructions folded into the system prompt.
- Server-side "system" MCP tools (`SystemToolsSource`, `composeToolsAdapters`) — credentials never reach the browser.
- Host tools (`HostToolGroup`, `displayName`, `qualifyNames`, `requireApproval`) and a pluggable `ToolsAdapter`.
- Tool permission modes: `Ask every time`, `Auto approve`, `Allow without asking`; "always allow" per server; MCP `readOnlyHint` / `destructiveHint` honoured.
- Tool results can carry images; tool cards show the model's one-line intent (`aiChatIntent`), source and arguments.
- Built-in tools: `web_search` / `web_crawling` (Exa or ONLYOFFICE / cloud backend) and `generate_image`; `disableBuiltinImageTool` opt-out.
- `read_skill` tool for Agent Skills of a connected room.

### Chat

- Streaming replies with Stop, Regenerate, Copy, Save as docx and host-defined `assistantActions`.
- Markdown with GFM, code blocks (shiki), KaTeX math, per-block RTL/LTR direction.
- Attachments: files, images (picker, clipboard, hotkey, drag-and-drop, `onDropFiles`), attach-by-path (`attachFilesByPath`), recent files, pending upload chips, 5-item cap.
- Prompt history with ↑ / ↓, saved prompts and folders (import / export bundles), host-configured `suggestions` and welcome screen.
- Cursor (keyset) pagination for threads and messages (`enablePagination`), newest page first, server-side history search.
- Auto-generated thread titles; chat history grouped by date; thread export to host-declared formats (`getExportFormats`).
- DocSpace room as chat context: `getContextFolders` / `getRoomSkills` / `getRoomSkill`, room skills with switches, `contextRoomScopesRounds`.
- Scroll-to-bottom button, thread fade overlays, optimistic user messages, image-generation placeholder animation.

### Settings

- AI Models page with add / edit / delete profiles, model list per provider, capability probes.
- Model Assignment page: `Default`, `Chat`, `Code`, `Summarization`, `Translation`, `TextAnalysis`, `ImageGeneration`, `OCR`, `Vision`, `FormAnalysis` slots with per-action fallbacks and entity scoping.
- MCP Servers page: JSON config editor, per-server toggle, permissions list, crash logs.
- Web Search page with blur or button save mode (`webSearchSaveMode`), reset and custom headers.
- Initial-setup screen when no profile is configured.

### Integration

- Adapters injected via context: `StorageAdapter`, `SettingsAdapter`, `PlatformAdapter` (`fetchProxy`, `externalFetch`, `copyToClipboard`, `showToast`, `file`, `env`, `clouds`).
- Server-API mode (`createServerAPI`, `ApiProvider`, `DEFAULT_*_ROUTES`) — the core runs on a host over HTTP with NDJSON streaming.
- Engines usable headless: `AIEngine`, `ThreadsEngine`, `ProfilesEngine`, `AssignmentsEngine`, `ToolsEngine`, `PromptsEngine`, `AttachmentsEngine`, `PreferencesEngine`, `WebSearchEngine`, `ContextEngine`.
- Host callbacks (`ChatCallbacks`): `onReady`, `onThreadsUpdated`, `onProfilesUpdated`, `onModelAssignmentUpdated`, `onServersUpdated`, `onWebSearchUpdated`, `onStreamError`, `onError`, …
- Imperative ref (`AIChatWidgetRef`): `approveToolCall`, `denyToolCall`, `updateProfiles`, `updateThreads`, `updateMCPServer`, `exportThread`, …
- Host-owned dialogs: `onDeleteThread`, `onDeleteProfile`, `onCreatePrompt`, `onEditPrompt`, `onCreatePromptFolder`, `onRenamePromptFolder`, `onDeletePromptFolder`, `onDiscardMcpChanges`, `onToolCallApproveResult`, `formatChatError`.
- Middleware (`beforeSend`) with attachment refs resolved on demand.
- Composite UI building blocks exported for custom layouts (`Layout`, `ChatList`, `Composer`, `ModelCard`, `HelpButton`, `Toast`, …); primitives swappable via `ComponentsProvider`.

### Theming & layout

- Seven built-in themes, `customTheme`, and CSS tokens for every surface: composer, dropdowns, chat history, settings pages, buttons, inputs, combo-boxes, toggles, dialogs.
- Widget flags: `hideProfilePicker`, `profilePickerReadOnly`, `hideSettingsButton`, `hideContextClouds`, `composerDisabled`, `composerHeader`, `composerActions`, `dropdownNavigation` (`flyout` / `drilldown`), `iconFormat`, `isDialogFullscreen`, `logLevel`, …
- Icons compiled to inline SVG components (CSP-safe) with multi-scale PNG fallback; theme-aware provider logos; host overrides via `images`.
- Scoped Tailwind preflight (`.aui-root`) — the widget never emits global CSS.
- Slim install: only `lodash.clonedeep` is a hard dependency; provider SDKs and UI libraries are optional peers.

### i18n

- 41 locales; translation overrides via `initAIChatI18n`; own i18next instance; RTL support.
