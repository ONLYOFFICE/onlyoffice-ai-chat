# Changelog

## 0.6.21

### Changed

- **Auto approve honours MCP tool annotations.** MCP tools never set `requireApproval`, so under `Auto approve` every one of them kept prompting even when the server declared it harmless. A tool annotated `readOnlyHint: true` or an explicit `destructiveHint: false` now runs without the dialog; a destructive or unannotated tool still asks, matching the protocol's default. `Ask every time` keeps ignoring the hints. `TMCPItem.annotations` is typed as `ToolAnnotations` and exported from the root and `/core` entries.

## 0.6.20

### Added

- **A "Permissions" row under Effort in the model picker.** It switches how a tool call the model makes is approved: `Ask every time` prompts for every call bar the tools pinned with "always allow", `Auto approve` keeps the previous behaviour (the pins plus a tool's own `requireApproval: false`), `Allow without asking` runs everything. The default is `Ask every time`, so a host tool that used to run silently now shows the dialog until the user picks `Auto approve` or pins it. The pick is persisted as a preference next to the thinking depth: optional `*ToolPermissionMode` methods on `PreferencesStorage`, `get`/`setToolPermissionMode` on `PreferencesEngine`, two `preferences/*-tool-permission-mode` routes, and `AIEngineDeps.defaultToolPermissionMode` for a host that overrides the default. `processStream` folds the mode into `tool-call-pending.autoAllow`, the one flag the UI, middleware and server-executed tools already obey. The mode type and its helpers are exported from both the root and the `/core` entry.

```ts
type ToolPermissionMode = "ask" | "auto" | "allow";
```

## 0.6.19

### Fixed

- **DeepSeek stays on `/chat/completions`.** DeepSeek answers `/v1/responses`, so the live probe moved its profiles onto the Responses transport, where the history replay drops reasoning; after the second tool round of a thinking-mode reply the model refused the request with `400 The reasoning_text in the thinking mode must be passed back to the API` (Bug 83335). The chat endpoint carries the thinking switch and `reasoning_content` on every round, and profiles already probed onto Responses are steered back.

## 0.6.18

### Changed

- **A picture a tool returns is capped at 300px high under its card.** A tall screenshot pushed the reply far down; the height comes from `--chat-message-tool-call-image-max-height`, and `generate_image` results keep their full size.

## 0.6.17

### Fixed

- **A collapsed thinking block is followed by the same gap as a tool call.** Its header row carried its own bottom margin on top of the block's, so the next part sat 8px lower; the gap now comes from the block's flex gap and appears only when the reasoning is expanded.

## 0.6.16

### Changed

- **Picked and recent files inline their text again by default.** Attaching by path only (0.6.12) is now opt-in through `WidgetConfig.attachFilesByPath`, for a host that registers its own file-reading tool; without it the file is converted with `convertFileToText` and its text goes into the prompt, as before 0.6.12.

```tsx
<WidgetConfigProvider config={{ ...config, attachFilesByPath: true }} />
```

## 0.6.15

### Fixed

- **A Claude model that rejects `thinking: disabled` is retried once with `between_tools` and remembered.** Anthropic's per-model table lags the live API: Sonnet 5 took `disabled` by the docs and answers the same 400 in practice. Because the capability probe runs with thinking off, that 400 also left such profiles with a false `canUseTool: false`; re-save the profile (or switch its model and back) to re-probe.

## 0.6.14

### Fixed

- **Claude Sonnet 5.5 no longer fails with `"thinking.type.disabled" is not supported for this model`.** Its off switch is spelled `thinking: {type: "between_tools"}` — the model does no extended thinking, only its short notes between tool calls come back as thinking blocks. It is accepted by that model alone, so Sonnet 5 and the rest still get `disabled`.
- **Groq profiles stay on chat completions.** The live probe moved them onto `/v1/responses`, where the OpenAI request shape adds `reasoning.summary` and Groq answers 400 on every round. Like OpenRouter, Groq skips the probe; xAI on Responses now uses its own reasoning table; any other endpoint that rejects `reasoning.summary` is retried once without it and remembered.
- **The capability probe tries chat completions only when the Responses API probe fails.** Firing both at once meant a guaranteed, logged and billed 400 on every profile save for models that cannot stop thinking (gpt-6, gpt-5.0, o-series, pro).

## 0.6.13

### Changed

- **Tool-result images are re-sent only within the current turn.** The model saw each picture in the round that produced it; resending every screenshot with each later message grew the context by its full size. Images before the last user message now reach the model as `[image from an earlier tool result, not resent]`.
- **A tool card shows at most 5 pictures.** A screenshot loop can return any number of them; the rest are not fetched. The model still gets them all.

### Fixed

- **Prompt-emulated tool calls no longer paste image base64 into `<TOOL_RESULT>`.** The text protocol cannot carry images, so the megabytes of base64 were noise; they are replaced by `[image attached]`.

## 0.6.12

### Breaking

- **Picked and recent files are attached by path only.** "Add local file" and "Recent files" no longer call `platform.file.convertFileToText`; the model gets `[attached file: <title>]` plus the path and reads the file through a tool the host registers (`hostTools` or MCP). Without such a tool the model sees only the name and path. Attachments that carry `content` (drag-and-drop text, DocSpace, `addAttachmentFile({ content })`) are still inlined. `convertFileToText` is deprecated.

### Added

- **A tool call shows its intent while its arguments still stream.** The intent is the first schema field, so the card is labelled before the real arguments arrive, on the prompt-emulated path too.

### Fixed

- **Message actions stay hidden while a tool call awaits approval**, since the reply resumes after allow or deny.
- **No "Analyzing" flash under a streaming reasoning block**; the approval dialog's "Always allow" no longer carries over to the next call.

## 0.6.11

### Changed

- **Prompt-emulated tool calls no longer require a lead-in sentence.** The fallback tools block (for models without native tool calling) dropped the rule asking for one short sentence before the `<tool_call>` block.

## 0.6.10

### Changed

- **The thread always follows the stream (Bug 84123).** The message area is anchored at the bottom and re-pins itself on every streamed token, the classic chat layout. Auto-scroll had been off by default in favour of the reading-first layout, which lifted the question to the top and let the answer grow below it; that layout confused users who expected the view to follow the answer.

### Removed

- **`WidgetConfig.autoScrollWhileStreaming` / `AIChatWidgetProps.autoScrollWhileStreaming`.** With the reading-first layout gone the flag had nothing left to switch; the `PendingTurnSlack` placeholder and the `data-auto-scroll` viewport attribute went with it. Hosts still passing the option get a type error and should drop it.

## 0.6.6

### Fixed

- **Long room and skill names truncate instead of stretching the menu.** The root-level room list had no width cap, so the panel grew to fit the longest name and the rows' truncation never applied. The context menu is capped through `--dropdown-context-menu-min-width` / `--dropdown-context-menu-max-width` (240 / 320 px) and the room chip's menu through `--chat-composer-room-menu-max-width` (320 px), both clipped to the space Radix reports, like the model picker.

## 0.6.5

### Added

- **Tool results can carry images.** An MCP server (custom, system or host-executed) that answers `tools/call` with `{ type: "image", data, mimeType }` content blocks — a screenshot tool, a chart renderer — now has its pictures seen by the model and shown in the chat. Before, the block was passed to the model as base64 inside the JSON text: unreadable to it, expensive in tokens, and rendered as raw JSON in the tool card. Now the base64 is moved to `storage.attachments` (`source: "tool"`, cascade-deleted with the message) and the message keeps `{ type: "image", ref, mimeType }`; on the way to the provider the ref is hydrated and the picture is sent natively — an `image` block inside Anthropic's `tool_result`, a `user` message with `image_url` / `input_image` parts after the tool output for OpenAI Chat Completions and Responses (the `tool` role is text-only there), an `inlineData` part beside the `functionResponse` for Gemini. The tool card renders every image below the call, for any tool, and the raw-result view shows `<base64 omitted>` in place of the payload. Detection is by result shape, so the built-in `generate_image` payload and an integrator's own image tools are unchanged.

### Fixed

- **The context menu's hint closes when the room list scrolls.** The popover stayed open and floated over rows its trigger had left; `HelpButton` now dismisses on any scroll outside its own content.

## 0.6.4

### Fixed

- **Disconnect room no longer scrolls away under a long skill list.** A room with many skills pushed the way out past the menu's height cap. The separator and Disconnect room now ride the menu's pinned footer, like Effort under the profiles: the switches scroll, the exit stays in view.

## 0.6.3

### Added

- **`WidgetConfig.hideContextClouds`.** Skips the cloud level of the composer's context menu: the rooms of every cloud are listed at the root, each still connected with its own cloud when picked, and the button wears the room glyph instead of the cloud. For a host that is one cloud to the widget (DocSpace is its own portal) the account row was a step with a single choice.

### Fixed

- **Hanging up on a streaming reply leaves it marked as stopped.** When the client disconnected after text had started arriving, the OpenAI-compatible streams (chat completions and Responses, so the ONLYOFFICE gateway too) reached the end of the SDK iterator without a `finish_reason`, saw content and reported a *finished* reply: the partial text was persisted with no status at all, and a thread reload showed it as a normal answer. The abort is now checked before the content, on every event and at the end of the stream, so the turn is stored as `incomplete / cancelled` with the text streamed so far — the same shape Stop in the composer produces (DocSpace bug 84028).
- **Claude Opus 5.5 no longer fails with `"thinking.type.disabled" is not supported for this model`.** Opus 5.5 thinks always, like Fable and Mythos: `disabled` is a 400 at every effort level and `output_config.effort` is the only knob. The model is now marked as impossible to switch off (`canDisable: false`), a stored off sends adaptive thinking at the standard depth, and the composer offers no switch for it. The Claude id parser also reads a dotted minor (`anthropic/claude-opus-5.5`), so the OpenRouter route gets the same treatment (DocSpace bug 84082).
- **"Always allow" on a custom MCP server's tool now sticks.** The approval dialog saved the bare name the model calls the tool by (`get_time`), while `set-allow-always` / `is-allow-always` key the list per server (`calculator_get_time`), so the saved decision was never found and, for a name without an underscore, was not persisted at all. All three paths — the dialog, the settings routes and the live round's auto-allow check — now derive one `${serverType}_${toolName}` token (`allowAlwaysToken`), and the flattened tool list stamps each adapter tool with its group so the round can attribute a bare call name to its server (DocSpace bug 84009). Decisions stored under a bare name before this release no longer apply and have to be granted once more.

### Changed

- **Test ids on the room-context controls**, in the naming master's `chore: add missed test ids` pass established: the context menu (`composer-settings-menu`, `context-menu-cloud`, `context-menu-room`, `composer-settings-help`), the room chip's menu (`composer-room-menu`, `composer-room-skill`, `composer-room-disconnect`) and the locked picker's current-profile row (`model-selector-current`). The drill-down back button is `dropdown-back-button` on every menu, labelled or not.
- Master merged in: the missed test ids across the settings pages.

## 0.6.2

### Fixed

- **Profile rows in the model picker are no longer indented by the Effort row's icon.** The pinned footer joins the menu's tree for navigation, and the icon column was reserved over that joined level, so every profile label sat a column in. The list and the footer are now judged apart: the profiles stay at the start, and an icon-less footer row still lines up with the footer's icon.

## 0.6.1

### Fixed

- **A room renamed while connected shows its new name.** `selectContextFolder` for the already connected room used to be a full no-op; it now takes over a changed name and still keeps the room's skills and switches.

## 0.6.0

The room-context line (0.5.134 – 0.5.139) merged with everything master
shipped since 0.5.118. The minor bump marks the two behaviour changes
hosts must know about: `hideProfilePicker: true` now locks the picker
instead of removing it, and `ServerAPIRoutes` / `createStores` require
the new `context` service.

### Added

- **A toast on a saved prompt**, via a new `Toast` component. It needs `@radix-ui/react-toast`, declared as an optional peer like the other Radix packages — a host that never saves prompts can leave it out.
- **Models are sorted** in the pickers and settings lists.
- **Tooltips for long prompt names** and for long chat titles in the history, so a truncated label can still be read.
- **Images from the clipboard and by hotkey** are attached to the composer.
- **Debug export keeps the whole response**, with nothing omitted.

### Fixed

- Inserting a prompt no longer clears what was already typed (Bug 84055).
- The model selection panel opens again, and stays open after the click that opened it (Bug 84070).
- A click moves straight to the next combobox on pages that stack them: the combobox dropdown is no longer modal, so it stops parking `pointer-events: none` on the page behind it.
- Dropdown menus render above overlays (Bug 84002); the actions icon shows on narrow devices (Bug 84073); the model setup layout is intact (Bug 84005); two layout regressions.
- The chat scrolls to a new message and to the bottom when reopened, without auto-scrolling while the user reads (Bug 83921, Bug 83684).
- Regenerate acts on the turn that was clicked, not the newest one.
- Dropped files are filtered by the allowed formats and keep their names (Bug 83956, Bug 83963); RTL detection is correct (Bug 83500); the model's reasoning is no longer inserted into the document (Bug 83764); images generate with Google models (Bug 83901).
- The caret lands correctly when walking the prompt history.

## 0.5.139

### Fixed

- **The connected-room chip no longer melts into the composer on hosts with their own surfaces.** It borrowed the input tokens, which on DocSpace dark are a grey two shades from the composer's. It is a block on the composer surface like the attachment chips, so it now shares their paint by default and gets tokens of its own for a host to override:

  ```css
  --chat-composer-room-background-color        /* default: --file-items-chat-background-color */
  --chat-composer-room-hover-background-color  /* default: --file-items-chat-hover-background-color */
  --chat-composer-room-border-color            /* default: --file-items-border-color */
  ```

## 0.5.138

### Fixed

- **The chat's "Export to…" item keeps the icon its "Save" predecessor had.** A host declaring several export formats turned the single "Save" entry into a submenu, which lost the icon and left the export row as the only one in the menu without one.

## 0.5.137

### Fixed

- **The connected-room chip's icon is drawn at its 24 px design size.** The glyph fills 15 of the asset's 24 px, so the 16 px box it was given left it at 10 px beside the room name.

## 0.5.136

### Fixed

- **The connected-room chip's icon and chevron were washed out in the dark themes.** They were painted with `--icon-button-color`, a dimmer grey than the white room name next to them. Both now take `--icon-normal`, the paint the model picker's chevron already uses (`--chat-composer-room-icon-color` overrides it). The chip's fill is back to the input tokens — 0.5.135 had made it transparent, which was not the problem.

## 0.5.135

### Fixed

- **The connected-room chip no longer stands out in the dark themes.** It was filled with `--input-background-color`, a different grey from the composer's own surface in the dark themes, so it read as a misplaced input. It is now transparent on the composer's surface, with the composer's border colour, the button highlight on hover and while open.

## 0.5.134

### Added

- **A DocSpace room can be connected to the chat as context.** A new cog in the composer's bottom row lists the host's cloud accounts (one row each, the ONLYOFFICE icon) and their rooms one level down; picking a room connects it at once, and a room button next to the cog shows it, with a *Disconnect room* entry. The widget knows nothing about rooms itself: three optional `StorageAdapter` methods supply everything, and a host without them sees no cog at all.

  ```ts
  getContextFolders?(): Promise<{ cloud: string; rooms: { id: string; name: string }[] }[]>;
  getRoomSkills?(cloud, roomId): Promise<{ id: string; name: string; description: string }[]>;
  getRoomSkill?(cloud, roomId, skillId): Promise<string>;
  ```

  The reads go through a new `ContextEngine` and the `context` service of the API bridge (`DEFAULT_CONTEXT_ROUTES`), so they work in server mode too, where the browser holds a stub adapter and the real one answers over HTTP. The clouds store exposes `fetchContextFolders`, `fetchRoomSkills` and `clearContextFolder` for a host whose clouds change at runtime; the widget itself never polls.

- **Skills of the connected room.** A skill is an Agent Skills Markdown file: frontmatter with `name` and `description`, then the instructions. The room button lists each skill with a switch. The enabled skills' names and descriptions go into the system prompt as a *skill index*, and the model reads a skill's body only when it needs it, through the built-in `read_skill` tool — so a room with many skills costs one index line each, not every body on every turn. The list is read once when the room is connected and travels with every round (`ActionArgs.contextRoom`); only `read_skill` reaches the host, and only on demand. Room-provided text is data, not authority: the index is framed as a catalogue, ids and names are escaped rather than rewritten, hidden (control, zero-width, bidi) characters are stripped, and a body is capped at 64 KB.

- **`WidgetConfig.contextRoomScopesRounds`.** Off by default: a connected room contributes its skills and nothing else, so on the desktop editors, whose rooms live in remote clouds, the room id never points local storage at a scope it has never heard of. DocSpace turns it on and the room's id becomes the round's `contextEntityId` while connected — its tools, allow-always preferences, assignment fallback and the host's per-scope agent instruction — while the thread stays under `entityId`.

- **`WidgetConfig.hideContextRoomDisconnect`.** Drops the *Disconnect room* entry from the connected room's menu, for a host that connects the room itself (DocSpace connects the room the user is in) and offers no cog to pick another — disconnecting would leave no way back. With it on, a room without skills shows nothing at all: an empty `.ai` folder is not worth a button.

- **`DropdownMenu` and `ComboBox` take `footerItems`.** Rows pinned below the list: the items scroll inside the menu's height cap, the footer stays in view. Root level only; in drill-down mode a drilled-in level replaces the whole menu.

### Changed

- **Effort lives in the model picker.** The reasoning depth applies to the model it is picked for, so the *Effort* row now sits at the foot of the profile picker, under a separator, pinned so it stays visible however many profiles there are. Web search is back in the paperclip menu, where it was.

- **`hideProfilePicker: true` locks the picker instead of removing it.** The picker also carries the Effort row, which has nowhere else to live, so it now stays on screen with a menu of exactly three rows: the current profile as an inert checked row, a separator, Effort. No other profiles, no `profilePickerActions`. The same applies to the `entityId` default. `profilePickerReadOnly` still renders the static label, unless an explicit `hideProfilePicker: true` locks the picker instead — the label would leave Effort unreachable. A host that set the flag to clear the model out of the composer will now see the locked picker.

### Removed

- The old composer *Servers* menu (`ComposerActionServers`), unused since the tool switches moved to the settings pages.

## 0.5.118

### Fixed

- **A chat keeps the name generated for it, even when its round ends first (Bug 83841).** The generated title was written from inside the generator carrying the reply, and only for as long as that generator lived: a title that resolved after the reply's terminal event — or after the consumer walked away — was dropped with no write and no event. A title is generated exactly once, on the round that creates the thread (every later round already carries a `threadId`), so the thread then stayed "New chat" for good. Agent chats hit this as a matter of course: their rounds pause for tool approval and continue as separate streams, so the round that owns the title is routinely the one that ends first.

  The title is now persisted out-of-band once it resolves, whatever ended the round — a terminal reply, an early `return`, a dropped connection. It is detached on purpose: awaiting it would hold the round, and the UI's busy state, open again, which is exactly what multiplexing the title into the stream removed. With no stream left to carry an event, the name reaches the UI with the next read of the thread rather than immediately, so a host that wants it on screen at once should refresh its thread list when a round ends.

  Two guards: a thread whose title is no longer the placeholder has been named by its owner and is left alone, and the placeholder is never written back over itself. A failed write is logged and dropped, as before. A round that pauses on a tool call is unchanged — it still delivers the title as a trailing event.

- **A failed title request says why.** `generateTitle` rejections were collapsed into the placeholder silently, so a refused, unauthorized or unreachable title request looked exactly like a thread whose name never arrived. The reason is now logged under `[title]`, alongside the existing log for a failed write.

## 0.5.117

### Added

- **The composer recalls previously sent prompts with ↑ / ↓.** The chat input had no way back to a request the user had already typed: repeating or tweaking one meant writing it out again. It now behaves like a command terminal — ↑ walks back through the prompts of the open chat, ↓ walks forward, and stepping past the newest entry restores whatever draft was in the box when the walk began. History only claims the arrow when it isn't stealing caret movement the user meant: the box is empty, or the caret already sits at the edge it would move towards (start for ↑, end for ↓) with nothing selected. Anywhere else the arrow moves the caret as before, so editing a multi-line draft is unaffected, and typing into a recalled entry makes it the user's own draft again.

  The history is the thread itself — its user messages, read from `useMessageStore`. Nothing is recorded a second time and no storage slice is involved, so a prompt is walkable the moment its message is in the store (the first send of a brand-new chat included), switching threads switches the history with it, and a new chat starts empty. Attachment-only sends carry no text and are not entries.

  A paginated host loads only the newest page of a thread, so `usePromptHistory().previous()` is async: a walk that reaches the top of the loaded window pulls the page before it through the store's existing `loadOlderMessages()` and continues there, exactly as scrolling up does. It keeps pulling while a page brings no prompt of its own, and stops at a page that brings nothing at all rather than spinning on a backend that cannot answer. The walk holds its place across the prepend — the cursor is a distance from the newest entry, not an index, so a page landing at the front of the list cannot shift it — and a step fired while a page is still on the wire is ignored, so holding ↑ down cannot skip the entries a key repeat outruns. A step whose page lands after the user has moved on — typing a fresh draft, or walking forward with ↓ — is dropped rather than applied, so a slow page cannot overwrite what the user has since put in the box. The hook is exported from `@onlyoffice/ai-chat/hooks` for custom shells.

- **A `FormAnalysis` assignment slot.** New `ActionType.FormAnalysis` (requires the `Chat` capability), exposed as a "Form analysis" row on the Model Assignment page and wired through the profiles store (`formAnalysisProfile`, `setFormAnalysisProfile`, `ModelAssignmentTask = "formAnalysis"`). It is the last member of the enum, matching the DocSpace backend, which already persists and resolves the slot over `ai/assignments` and picks its default from the configured `ai:formAnalysisModel` gateway model. The slot has no entry in `SYNC_ACTIONS` — form analysis runs server-side, so there is no client-side action to dispatch — and no `ACTION_FALLBACKS` hop, so an unset slot falls through to `Default` as the other slots do.

### Fixed

- **Clicking from one combobox to the next takes one click again.** The dropdown was a modal Radix menu, and a modal menu parks `pointer-events: none` on the body for as long as it is open. On a page that stacks comboboxes — the Model Assignment rows, the model config form — the click meant for the next trigger therefore landed on nothing: it dismissed the open panel and went no further, so reaching the neighbouring list took two clicks. The combobox now opts out of modality, which is what the hover flyout in the dropdown rows already does for the same reason; nothing about a combobox needs to block the page behind it.

- **A tool-capability probe gets two minutes instead of fifteen seconds.** Saving a profile asks the model to call a test tool to learn whether it supports function calling. A profile backed by a CLI bridge (`claude -p` or `codex exec` behind an OpenAI-compatible server) spends most of a request on process start, and a cold start easily outlived the 15 s limit; the false negative stuck the profile in the text-protocol fallback for good, since the probe only reruns when the model or base URL changes. A model that does answer still returns in seconds, so the save button waits longer only when nothing is coming back anyway.

- **MCP tool results reach Claude on the ONLYOFFICE route.** The cache-control pass rewrote a trailing `tool` message into a `tool_result`-typed content block, a type that does not exist in the chat-completion wire format. The gateway dropped it while converting to Anthropic, and Claude received an empty tool result — the output of `download_file_as_text` and every other MCP tool never reached the model. Tool messages are now never touched; when the conversation ends on one, the second cache breakpoint moves back to the nearest non-tool message.

- **A rejected parameter no longer shows as "Selected model unavailable" (Bug 83703).** The 400 branch of the error classifier turned any message containing the word "model" into `model_not_found`, so Anthropic's `"thinking.type.enabled" is not supported for this model` came out as an unavailable model with a Retry button that could not help. A 400 is now `model_not_found` only on an explicit code or a phrasing providers use for a missing model ("does not exist", "not found", "unknown model" and the like); any other 400 stays `bad_request` and shows the provider's own text.

- **Stopping a Claude reply mid-thought no longer breaks the next request (Bug 83732).** Anthropic sends a thinking block's signature as its last event, so a reply stopped while Claude was still thinking persisted a reasoning part with no signature, and the next request replayed it as a `thinking` block with an empty one — rejected as `Invalid signature in thinking block`. The unsigned block was already dropped since Bug 83335; the remaining hole was the blank text block a stopped round leaves behind, which Anthropic rejects as well and which OpenAI-compatible streams also emit. It is skipped too, and an assistant turn left with nothing to say is omitted from the request entirely.

- **Gemini accepts the editor's tool catalogue (Bug 83699).** Gemini validates tool schemas against its own `Schema` subset and fails the whole request on the first violation, so a single property declared with `enum: [2, 3]` made every Google AI request answer `INVALID_ARGUMENT`, even one asking for a plain "OK". Every `inputSchema` now passes through `sanitizeGeminiSchema` before going on the wire: unknown JSON Schema keys are dropped, a union type becomes type + `nullable`, an undocumented `format` is dropped, and a non-string enum is replaced by an "Allowed values" note in the description, so the model still sees the choices and the host still receives a number.

  ```ts
  // { type: "integer", enum: [2, 3] } → { type: "integer", description: "… Allowed values: 2, 3" }
  ```

- **A draft of attachments alone can be sent.** Dropping a file into the composer and pressing Enter (or Send) with no text did nothing: both paths gate on assistant-ui's runtime-level `composer.isEmpty`, which counts the runtime's own attachment list and never sees the widget's `useAttachmentsStore`, so a file-only draft looked empty to it. Send is now driven directly — enabled on either text or a settled attachment — and the composer's own `onSubmit` takes over whenever attachments the runtime cannot see are present. `onNew` no longer drops such a send either: an attachment-only message arrives with no text block at all, which the old `message.content[0].type !== "text"` guard rejected outright. The resulting message renders as the file chips alone — no empty text bubble under them, and no copy / save-as-prompt bar, neither of which has anything to act on.

- **The copy button reports the copy instead of looking broken.** After a successful copy the button swapped to a checkmark and was rendered `disabled`, which painted a `not-allowed` cursor over a control the user had just used, and its tooltip was suppressed outright — the click read as a failure. The checkmark state now uses `disableHover` and keeps its tooltip, which says "Copied" while the state lasts and returns to "Copy to clipboard" after. Applies to all three copy buttons — assistant message, user message and code block — and the assistant one reads its copied state from the assistant store (`useAssistantState`) so icon and tooltip come from a single value.

- **The checkmark of a checked checkbox stays legible in the dark themes.** `--checkbox-active-icon-color` resolved to `--background-normal`, which in the dark, night and contrast-dark themes is close enough to the checked box's accent fill to swallow the mark. It now resolves to `--text-contrast-background`, the token meant for content sitting on an accent surface, and the checkbox draws the dedicated `checked-white` asset.

- **A rejected parameter no longer shows as "Selected model unavailable" (Bug 83703).** Any 400 mentioning the word "model" was classified as `model_not_found`, hiding the provider's real message. Now only an explicit `model_not_found` code or a missing-model phrasing maps there; other 400s stay `bad_request` with the provider's text.

- **No more `400 Invalid signature in thinking block` after stopping a reply (Bug 83732).** A reply stopped mid-thinking left an unsigned reasoning part and an empty text block; both are now skipped, and an assistant turn left empty is omitted from the request.

- **Gemini no longer answers `400 INVALID_ARGUMENT` on every request (Bug 83699).** Tool `inputSchema`s are passed through `sanitizeGeminiSchema`: unknown JSON Schema keys are dropped, union types become type + nullable, non-string enums move into the description as "Allowed values".

### Changed

- **The message action that exports a chat is labelled "Save as docx".** It shared the generic `Save` key with every submit button in the widget, and its floppy-disk icon read as "save this message" rather than "download it" — the action always exports a .docx. It now has its own translation key and the `btn-download` icon.

- **The file-format icons are redrawn as document sheets.** Every format icon (documents, spreadsheets, presentations, pdf, pdf-form, djvu, visio, xps and the unknown-format fallback) was a solid rounded square with a white glyph, which sat oddly against the file chips in the composer and message list. They are now page-shaped sheets with a folded corner and a per-format mark, matching the rest of the ONLYOFFICE icon set, at every raster density.

## 0.5.116

### Fixed

- **MCP tool results reach the model again on the ONLYOFFICE route.** The prompt-caching breakpoint on the final message rewrote a trailing `tool` message into a `tool_result`-typed content block. That block type does not exist in the chat-completion wire format, the gateway's OpenAI-to-Anthropic conversion dropped it, and Claude received an empty tool result — a `download_file_as_text` call showed the document text in the tool card while the assistant reported the file as unreadable. `tool` messages are now never touched; when the conversation ends on one, the breakpoint moves back to the nearest non-`tool` message.

## 0.5.115

### Changed

- **A long answer no longer scrolls itself away while it is generated.** The thread followed the stream token by token, so a response taller than the message area dragged its own beginning off-screen: the reader had to scroll back up to start reading, for every long answer. Sending still jumps to the bottom, but from there the reading position stays where it is and the answer grows below it. The floating "scroll to bottom" button needs no new wiring to announce that growth — `ThreadPrimitive.ScrollToBottom` un-disables itself the moment there is content past the fold, so the existing arrow becomes the "more below" indicator and returns the reader to the end in one click.

  The follow was assistant-ui's `autoScroll`: a resize observer on the viewport content that re-pins it to `scrollHeight` on every growth while its `isAtBottom` flag holds. The scroll-to-bottom on send sets that flag, and the primitive only clears it when the user scrolls *up* themselves, so the follow never stopped on its own. It is now off (`autoScroll={false}`), while `scrollToBottomOnRunStart` — the jump on send — keeps its default. The new `autoScrollWhileStreaming` widget config restores the classic behavior for hosts that want it.

  With nothing re-pinning the viewport, the browser's own scroll anchoring is what holds the reading position steady as content grows, so the `overflow-anchor: none` on `.thread-viewport` is now scoped to the opt-in case (`[data-auto-scroll="on"]`) — there the runtime writes the offset itself and the two would fight over the same frame. Anchoring also cooperates with `OlderMessages`, which measures its gap from the bottom of the content and deliberately does not re-base while the height is still moving.

## 0.5.114

### Fixed

- **A DeepSeek thinking-mode dialog no longer fails with `400 The reasoning_content in the thinking mode must be passed back to the API` after a tool call (Bug 83335).** DeepSeek checks every assistant message with `tool_calls` in the current turn for a `reasoning_content` key; the key only has to exist, an empty string passes. The OpenAI converter set it only when the round carried a reasoning part, so a tool round the model answered without thinking broke the resume request. `DeepSeekProvider` now sends the field on every assistant message (`reasoningContentMode = "always"`, a new protected knob on `OpenAIProvider`; other OpenAI-compatible providers keep the old when-present behaviour). `convertMessages` takes an options object (`{ downgradeSystem, reasoningContent }`); the boolean form is still accepted.
- **A tool loop is replayed round by round.** The engine resumes into the same assistant message, so one stored message holds every round of a tool loop. It went out as a single assistant message with every `tool_call`, only the last reasoning, and the closing text ahead of the tool results. Each round is now its own assistant message with its own `reasoning_content`, followed by its `tool` results — the shape the model produced, and the one DeepSeek's docs require for thinking mode.
- **Switching a thread from DeepSeek to Claude no longer fails with `invalid "signature" in "thinking" block`.** The Anthropic converter turned every reasoning part into a `thinking` block signed with its `parentId`, which for reasoning streamed by another provider is the synthetic id the OpenAI stream stamps on a finished block. Only a signature Anthropic issued (`isThinkingSignature`) is replayed now; foreign reasoning is dropped and the turn's text and tool calls still go out.

## 0.5.113

### Changed

- **The Effort row's off entry reads "No thinking".** The translation key `Off` is renamed `NoThinking` in all 41 locales (`t("Off")` no longer compiles); it still appears only for a model whose thinking can be switched off.
- **A new chat model starts at its own default depth.** Switching the chat model — a composer pick (`setSessionChatProfile`), a persisted Chat assignment (`setChatProfile`), or an edit of the current profile onto another model — now moves the reasoning level to the new model's default depth and persists it: the catalogue's `default_effort` where the provider reports one (`ReasoningSupport.defaultDepth`), else `medium`, clamped to the depths the model distinguishes. Previously the level carried over unchanged, so `max` chosen for one model stayed selected on a model without `max`, and a model that cannot stop thinking could sit on Off. An Off the user chose stays on a model that can be switched off; a model that cannot stop starts thinking at its default depth. Picking the same profile and model again changes nothing. `onExtendedThinkingUpdated` fires with the adopted level. `resolveProfileReasoningSupport` moved to `src/ui/store/profile-reasoning-support.ts` (still re-exported from the hook) alongside the new `defaultReasoningDepth(support)`.

## 0.5.112

### Added

- **A round can name the entry it is billed to.** New `SourceMeta` (`{ id, type?, title? }`) travels `ActionArgs.source` → `ProviderCredentials.source`; the ONLYOFFICE provider sends it as the request `metadata` (`source_id` / `source_type` / `source_title`) on every request — streaming chat, one-shot actions, image generation — replacing the legacy `agent_id` / `agent_title` pair when present. The DocSpace host used to reach this by shadowing the provider class; the field is now first-class.
- **`AIEngineDeps.resolveSource` / `ThreadsEngineDeps.resolveSource`.** A host hook called once per entry point (send, stream, regenerate, tool-call resume, title generation) with the round's context scope and thread. Its answer is threaded into every provider request of the round, including tool-call resume rounds and the built-in `generate_image` tool, and is authoritative: when the hook is wired, a caller-supplied `actionArgs.source` is ignored and the legacy `entityId` / `entityTitle` pair is dropped as well, so an unresolved round sends no `metadata` at all rather than a client-chosen `agent_id` — a client can only name an entry, never describe one it cannot see. Without the hook the caller's fields are forwarded as-is.
- **Built-in web search is billed to the same entry.** `callWebSearchTool` accepts the round's `source` and, on the ONLYOFFICE / cloud branch only, adds it to the `search` / `contents` body as the same `metadata` object. Previously the two web-search tools were the one paid operation that carried no attribution. Exa never receives it.

  ```json
  { "engine": "exa", "query": "…", "numResults": 5, "metadata": { "source_id": "42", "source_type": "Room" } }
  ```

- `sourceMetadataFields` / `SOURCE_METADATA_KEYS` are exported so a host that builds a gateway request body itself spells the keys from one place.

## 0.5.110

### Fixed

- **Tool results reach the ONLYOFFICE gateway as `tool_result` blocks.** The gateway proxies to Claude and maps a block inside a `tool` message onto Anthropic's `tool_result`, which is where the prompt-caching marker must sit. `withCacheControl` used to wrap the trailing tool message in a `text` block, which the gateway rejected; the block is now typed by role. Other providers are unaffected — only the ONLYOFFICE provider places cache markers.

  ```json
  { "role": "tool", "content": [{ "type": "tool_result", "text": "{\"content\":[...]}", "cache_control": { "type": "ephemeral" } }] }
  ```

### Changed

- **`structuredContent` is no longer sent to the model.** MCP requires a server that returns `structuredContent` to mirror it as a text block in `content`, so the field only duplicated a payload the model already receives and doubled its token cost. All three MCP tool-call paths (server HTTP, browser HTTP, browser stdio) now serialise through `serializeMcpToolResult`, which drops it.

## 0.5.109

### Changed

- **A streaming assistant message is persisted on a timer, off the delta loop.** `processStream` used to write the whole message to `storage.messages.update` whenever a delta arrived more than 150 ms after the previous write — and it awaited that write inside the delta loop, so against a remote storage adapter every write paused the stream itself. The loop now only stages the latest snapshot; a `setInterval` flushes it at most once per `persistIntervalMs` (new `AIEngineDeps.persistIntervalMs`), a tick that lands while a write is still in flight is skipped so writes never overlap or reorder, and a failed periodic write is logged and retried on the next tick rather than failing the round. The default stays at 150 ms (`DEFAULT_PERSIST_INTERVAL_MS`) — right for a local adapter; a host whose adapter is a remote HTTP hop raises it to a few seconds. Values under 50 ms (`MIN_PERSIST_INTERVAL_MS`) are clamped and non-positive or non-finite ones fall back to the default, so a misconfigured interval cannot turn the timer into a write-per-macrotask loop. The first `create` (which yields the `messageId`) and the terminal write — `message-end`, `message-incomplete`, `tool-call-pending`, or the salvage after a stream that ends without `isEnd` — are unchanged and always wait for an in-flight periodic write first. If the stream dies early instead (the provider throws, the consumer stops iterating), the staged snapshot is still written best-effort on the way out, and the timer is cleared in `finally` either way. The UI still receives every `message-delta`.

## 0.5.108

### Fixed

- **The hint button on a submenu row can be clicked at all.** The flyout submenu of a row is its own Radix `DropdownMenu.Root` nested in the parent menu, and it opens the moment the pointer enters the row. As a modal root (Radix's default) its `DismissableLayer` disables pointer events on every lower layer — the parent menu included — so by the time the pointer reached the "i" of the composer's Effort row the row could not be clicked: the click fell through to the page, the hint never opened and the submenu just stayed put. The hover flyout now passes `modal={false}` (`DropdownMenuProps.modal`, new; default unchanged), so the parent's rows and their controls stay live while it is open. A click-opened "⋯" menu keeps the modal default.

- **The hint button on a menu row opens its hint instead of acting on the row.** Once reachable, a click on the "i" of a `withAbout` row bubbled to the Radix menu item, which selected the row: in flyout menus it ran the row's action and closed the menu, taking the hint popover with it; in `dropdownNavigation: "drilldown"` it descended into the submenu. `DropDownItem` now recognises a click coming from the about button on every row (the toggle rows had this guard already) and stops it before Radix selects the row, so the hint opens and the menu stays where it is.

## 0.5.107

### Added

- **OpenRouter requests carry routing hints.** Following OpenRouter's latency-and-performance guide, every chat-completions request now sends the thread id as `session_id` — for about ten minutes the turns of one chat stick to the endpoint holding the warm KV cache, so tool rounds stop paying the prompt prefix again — and a `provider` object with `preferred_max_latency: { p90: 2.5 }` (endpoints whose p90 time-to-first-token stays under 2.5 s are tried first; slower ones remain as fallback) and `sort: { by: "throughput" }`. No `provider.order` is pinned, so OpenRouter's load balancing stays on. `ProviderCredentials.sessionId` is thus read by OpenRouter as well as ONLYOFFICE; the other providers still ignore it.

  ```json
  { "session_id": "<threadId>", "provider": { "preferred_max_latency": { "p90": 2.5 }, "sort": { "by": "throughput" } } }
  ```

## 0.5.106

### Fixed

- **Drill-down menus no longer reopen inside a submenu.** In `dropdownNavigation: "drilldown"` the navigation stack was reset from Radix's `onOpenChange`, which a controlled menu never receives when the host closes it by flipping `open` — and the prompts menu closes exactly that way from every leaf action. Descending into a prompt's "⋯" menu and moving the prompt to a folder left the stack behind, so the next open landed in that prompt's context menu instead of the root. The stack is now cleared on the close itself.

- **A drill-down level survives the tree being rebuilt around it.** The stack addressed rows by position, so any rebuild that shifted the current level's composition — moving a prompt out of the root drops its row and can drop the separator with it — silently re-pointed the path at a different row, e.g. another prompt's context menu. Rows carrying an `id` are now addressed by it; rows without one keep the positional behaviour. The prompts menu labels its prompt, folder and context-menu rows accordingly.

- **"Back" and "⋯" no longer need a second press after such a rebuild.** When a rebuild invalidated the tail of the stack, the visible level fell back to the deepest valid one but the stack kept the dead tail, and both navigation actions were computed from the stack: going back only dropped the dead step (the level did not change) and drilling in appended onto a dead branch (nothing opened). Both now move relative to the level actually on screen.

## 0.5.105

### Fixed

- **A route that rejects reasoning off no longer fails the round.** OpenRouter's catalogue flags a model as `mandatory` when its thinking cannot be switched off, and the composer hides Off on that word — but the flag is a per-model verdict that does not always match the endpoints behind it: DeepSeek V4 reports `mandatory: false` and answers `reasoning: { effort: "none" }` with `400 Reasoning is mandatory for this endpoint and cannot be disabled.` OpenRouter and the ONLYOFFICE route now catch exactly that answer on a round sent with reasoning off and send it once more at the depth a stored Off means on a model that cannot stop — the catalogue's `default_effort`, else the standard depth clamped to the model — so the round completes (thinking on, as the endpoint insists) instead of surfacing the error. Any other failure, a failure of the retry, and a round that asked for a depth are left alone. `isMandatoryReasoningError`, `mandatoryReasoningLevel` and `retryWhenReasoningMandatory` live in `openrouter/reasoning.ts`; `OpenAIProvider` gains a protected `getCompletion` (the one-shot counterpart of `getStream`) so a gateway subclass can wrap both request shapes.

## 0.5.104

### Fixed

- **The request now reasons at the depth the composer shows.** The Effort row resolves the stored level against `Profile.reasoningSupport` — the per-model record the OpenRouter / ONLYOFFICE catalogue reported at save time — while every request builder resolved it against the provider's id-based table only. Where the two disagreed the composer and the wire parted ways: a route the catalogue marks `mandatory` but the table does not know (`openai/gpt-6-astra`, `deepseek/*`, …) showed the standard depth after a stored Off, yet the round went out with `reasoning: { effort: "none" }` — a 400 upstream, or no thinking at all. `providerFor` now hands the profile's record to the provider as `ProviderCredentials.reasoningSupport` (new, optional), and every built-in builder reads it through `AbstractBaseProvider.reasoningSupportFor(model, table)` (new, protected) before falling back to its own table: OpenRouter and ONLYOFFICE (`openRouterReasoningFields` takes an optional `support`), OpenAI-compatible (`resolveReasoningEffort` / `resolveReasoningParam` take an optional `support`), Anthropic (`resolveThinkingParam`), Google (`resolveThinkingConfig`), xAI and Groq. `ActionArgs.profile` picks `reasoningSupport` too. Hosts that persist profiles already pass the field; hosts that construct providers directly can now pass it in the credentials.

## 0.5.103

### Added

- **Extended thinking has a depth, not just a switch.** A provider-neutral `ReasoningLevel` (`off` / `low` / `medium` / `high` / `max`) travels from the composer to every provider: `SendMessageArgs.reasoningLevel`, `SendMessageSyncArgs.reasoningLevel` and `ActionArgs.reasoningLevel`, threaded through every engine path (tool-call resumes included). The legacy `withReasoning` / `isReasoning` booleans keep working and mean `medium`; when both are set the level wins. Each provider maps the level onto its own knob and clamps to what the model accepts instead of sending a value the API would reject:

  | Provider | Knob | low → max |
  | --- | --- | --- |
  | Anthropic 4.6+ / 5 / Fable | `thinking: adaptive` + `output_config.effort` | `low` / `medium` / `high` / `max` |
  | Anthropic ≤ 4.5 | `budget_tokens` | 4000 / 10000 / 20000 / 28000 |
  | OpenAI gpt-5.x / gpt-6 / o-series | `reasoning_effort` | `low` / `medium` / `high` / `max` (5.5+, gpt-6), `xhigh` (5.2+, codex-max), `high` elsewhere |
  | Google Gemini 2.5 / 3.x | `thinkingLevel` | `LOW` / `MEDIUM` (`HIGH` on 3 Pro preview, which has no medium) / `HIGH` / `HIGH` |
  | OpenRouter | `reasoning.effort` | `low` / `medium` / `high` / `xhigh` |
  | DeepSeek V4 | `thinking.type` + `reasoning_effort` | `low` / default depth / `high` / `max` |
  | Groq Qwen 3.8+ / GPT-OSS | `reasoning_effort` | `low` / `default` or `medium` / `high` / `high` (other Qwen: `default` only) |
  | xAI grok-4.5+ | `reasoning_effort` | `low` / `medium` / `high` / `xhigh` (4.6+) |
  | xAI grok-3-mini | `reasoning_effort` | `low` / `high` / `high` / `high` |
  | Zhipu, Mistral | on/off only | any level above off enables |

  The composer's Extended thinking toggle is replaced by one **Effort** row (its submenu is exempt from the dropdown's 14rem height cap — `DropDownItemProps.subMenuMaxHeight`, new — so it never scrolls in hosts with taller rows): the current depth as its value, an "i" with the cost note, and a submenu that lists Off and the depths with a check mark on the active one. `onExtendedThinkingUpdated` now carries `level` next to `enabled`; the profiles store exposes `reasoningLevel` and `setReasoningLevel(level)` (its `toggleExtendedThinking` stays and restores the depth chosen last). Locale keys: `Effort`, `Off`, `On`, `ThinkingLevelLow` … `ThinkingLevelMax`, `ExtendedThinkingAlwaysOn` added to all 41 locales.

- **The thinking controls adapt to the model.** Each provider describes every model through a `ReasoningSupport` record (`thinks`, `canDisable`, `depths`) in an SDK-free `reasoning.ts`, served synchronously by the registry as `getReasoningSupport(type, model)` — the same table the request builders clamp to (`clampReasoningLevel`: nearest listed depth, ties upward), so what the menu shows is what goes on the wire. A model that cannot think (gpt-4o, Gemini 2.0, Llama on Groq, Claude 3.5, …) gets no Effort row at all; one that thinks always (Claude Fable, Grok 4.5+, Gemini 3) lists no Off and says so in its "i" note — a stored Off then means the standard depth, `medium` clamped to the model, which is what the request carries (`effectiveReasoningLevel`) and what the row shows; a model with a switch but no depth (Zhipu, Mistral) lists Off / On; one that thinks always with no knob (grok-4, `deepseek-reasoner`) has nothing to choose and no row. The depths listed are only the ones the model distinguishes — `low` / `high` on Gemini 3 Pro preview and grok-3-mini, `medium` … `max` on the OpenAI `pro` variants — and the value shown is the depth the model actually runs when the stored pick is not among them. For OpenRouter and ONLYOFFICE the table comes from the catalogue itself: `/models` reports a per-model `reasoning` object (`mandatory`, `supported_efforts`, `default_effort`), which is stored as `Model.reasoningSupport`, copied onto the profile at save time (`Profile.reasoningSupport`, new) and preferred over the id-based table — so a model that OpenRouter marks mandatory (Grok, Claude Fable) offers no Off, and a stored Off runs its catalogue default. An `external` profile is answered for the provider it is based on; ONLYOFFICE, a one-to-one proxy in front of OpenRouter, uses OpenRouter's unified `reasoning` object and per-route table instead of OpenAI's `reasoning_effort`, and like OpenRouter stays on `/chat/completions` (profiles an earlier build probed onto the Responses transport are steered back). Custom providers join in through the optional static `getReasoningSupport(model)` on `ProviderConstructor`; without it they are assumed to think at every depth with an off switch, as before.

- **Persistence.** `PreferencesEngine.getReasoningLevel` / `setReasoningLevel` (routes `GET preferences/get-reasoning-level`, `PUT preferences/set-reasoning-level`) and five *optional* `*ReasoningLevel` methods on `PreferencesStorage`. Deep mode stays the master switch, so a host that only knows the boolean keeps full control: off means `off` whatever depth is stored, on means the stored depth or the default (`PreferenceDefaults.reasoningLevel`, `medium`). A host without the new routes or storage methods is fine — the widget falls back to the deep-mode routes after the first failed call and keeps the chosen depth in memory for the session.

- `ReasoningLevel`, `ReasoningDepth`, `ReasoningSupport`, `REASONING_LEVELS`, `REASONING_DEPTHS`, `DEFAULT_REASONING_LEVEL`, `FULL_REASONING_SUPPORT`, `NO_REASONING_SUPPORT`, `isReasoningLevel`, `resolveReasoningLevel`, `reasoningSupport`, `clampReasoningLevel`, `effectiveReasoningLevel` the registry's `getReasoningSupport` and the catalogue converter `reasoningSupportFromCatalog` (with `OpenRouterReasoningMeta`) are exported from the package root and `/core`. `Profile.reasoningSupport` is on both the widget and the core `Profile` type, so hosts persisting profiles see it.

### Changed

- **Models that cannot stop thinking get no Off in the composer.** A stored Off there means the standard depth — `effort: "medium"` on `x-ai/*` and Claude Fable / Mythos through OpenRouter, `output_config.effort: "medium"` on Claude Fable / Mythos, `reasoning_effort: "medium"` on Grok, GPT-OSS, gpt-5.0 / gpt-6 and the o-series (`"high"` on grok-3-mini, which has no medium), `thinkingLevel: MEDIUM` on Gemini 2.5 Pro and 3.x (`HIGH` on 3 Pro preview) — so the composer shows the depth that really runs. Every model that can stop keeps its real off switch: `none` on OpenRouter (Claude included — OpenRouter turns it into `thinking: disabled`), `thinking: disabled` on Claude 4.6+, `reasoning_effort: "none"` on gpt-5.1+, `thinkingBudget: 0` on Gemini 2.5 Flash.

- **`reasoningRequestFields` / `reasoningResponsesFields` on `OpenAIProvider` take a `ReasoningLevel`** instead of the `withReasoning` boolean, as does `getStream`'s `reasoningLevel` param. Subclasses that override these hooks need the new signature; `AbstractBaseProvider` implementations are unaffected — they read `args.reasoningLevel` / `args.withReasoning` and can use `resolveReasoningLevel(args)`.

### Fixed

- **OpenAI-family requests no longer send `reasoning_effort` to models that do not think.** With the toggle on, `"medium"` went to every model, gpt-4o and gpt-4.1 included, which reject the parameter. The known non-reasoning families now get no field; ids an OpenAI-compatible backend serves are still assumed to reason.

- **xAI no longer sends `reasoning_effort` to Grok models that reject it.** The inherited OpenAI mapping sent `"medium"` to every xAI model with thinking on; grok-4, grok-4.1-fast and grok-code-fast reject the parameter, so the round failed with a 400. It is now sent only where xAI documents it: `low` / `medium` / `high` (and `xhigh` from 4.6) on grok-4.5 and newer, `low` / `high` on grok-3-mini, nothing elsewhere. Off sends nothing on every Grok — the reasoning cannot be disabled.

## 0.5.97

### Added

- **Stdio MCP servers can change their tool list at runtime.** A server that advertises `capabilities.tools.listChanged` pushes `notifications/tools/list_changed` when its catalog changes; the widget ignored every server-initiated message, so a tool registered after start-up never reached the model until the server was restarted. The notification now triggers a fresh `tools/list`, the server's group in the tool map is replaced and `tools-changed` fires, so the permission cards and the next chat round see the new catalog. Bursts are debounced (250 ms) and a notification arriving while a listing is in flight queues exactly one more listing after the answer, so responses cannot land out of order.

  The client also sends `notifications/initialized` after the `initialize` response — the handshake step a compliant server waits for before pushing any notification of its own — and answers server-initiated requests: `ping` with an empty result, anything else with JSON-RPC `-32601` instead of leaving the server's loop blocked on a reply. HTTP servers are not covered: their notifications travel over a `GET` SSE stream the browser client does not open.

### Fixed

- **A frame the host will not spawn from no longer shows a spinner forever.** The ONLYOFFICE desktop renders each settings page in its own iframe and refuses `_createProcess` there: the handle comes back without a process id, its output callback is registered under `undefined`, and every `initialize` went unanswered while the card spun. Such a handle is now recognised right after `start()`; the server is marked stopped with a log line naming the frame, and no handshake is attempted. A rejected `initialize` (mcp-go's "duplicate initialize received" when the retry sent a second one before the first answered) is also no longer taken for a completed handshake.

- **Stdio stdout is now line-framed.** Each `onprocess` chunk was parsed as one JSON document, so a response split across two chunks, or a response sharing a chunk with a notification, was dropped with a parse warning. Chunks are cut on `\n`, an unterminated tail is kept for the next chunk, and a stray non-JSON log line is discarded instead of poisoning the messages after it.

- **Every new stdio process starts with `initialize`.** The "initialized" flag survived a restart, a delete-and-re-add and a widget remount, so the next process received `tools/list` before its handshake — which servers such as `github-mcp-server` reject ("invalid during session initialization"), leaving the card spinning forever. A stale stop mark from the previous process had the opposite effect and aborted the handshake before the first `initialize`. Both are cleared whenever a process is spawned, and a `tools/list` that comes back as a JSON-RPC error re-runs `initialize` once for that process.

- **Request ids no longer collide.** `tools/list` ids were suffixed with `Date.now()`; two listings within a millisecond (start-up plus a `list_changed` refresh) shared an id. A per-instance counter is used instead.

- **A server that lists zero tools no longer stalls the send.** `waitUntilReady` treated an empty tool array as "not listed yet" and waited out the 3-second deadline; it now checks whether the listing was answered, so an empty (or emptied by a refresh) catalog resolves right away.

## 0.5.88

### Fixed

- **Connecting a provider no longer defaults the model to a generation-only one.** The model form picked the first listed model, and some providers sort image/video models to the top (xAI lists `grok-imagine-video-1.5` first), handing the user a profile that fails its very first text request with `model_not_found`. The default is now the first chat-capable model; xAI's `imagine`/`video` ids are classified as Image instead of Chat, keeping them out of every chat picker (DocSpace bug 83730).

- **Extended thinking off now actually turns reasoning off on every provider that can.** "Off" used to mean "send nothing", and most current models think by default when nothing says otherwise, so the toggle had no effect on them. Each provider now sends its own explicit off switch:

  | Provider | Off | On |
  | --- | --- | --- |
  | OpenRouter | `reasoning: { effort: "none" }` | `reasoning: { effort: "medium" }` |
  | Anthropic 4.6+ | `thinking: { type: "disabled" }` | `thinking: { type: "adaptive" }` |
  | Google AI 2.5 / 3.x | `thinkingBudget: 0` (2.5 Flash) or the model's lowest `thinkingLevel` | unchanged |
  | DeepSeek | `thinking: { type: "disabled" }` | `thinking: { type: "enabled" }` |
  | Zhipu GLM-4.5+ | `thinking: { type: "disabled" }` | `thinking: { type: "enabled" }` |
  | Groq Qwen | `reasoning_effort: "none"` | `reasoning_effort: "default"` |

  Gemini 2.5 Pro and Gemini 3 have no real off switch, so their floor level is sent; Groq's GPT-OSS cannot stop reasoning either and gets `include_reasoning: false` so the thinking at least stays out of the stream. Models without thinking receive no field, as before.

- **OpenRouter profiles never received the widget's reasoning setting.** OpenRouter answers `/v1/responses`, so the live probe routed its profiles onto the Responses transport, and that path built its `reasoning` object from the OpenAI table, which has no entry for `anthropic/*` ids and omitted the field. OpenRouter now stays on `/chat/completions` — the one OpenRouter endpoint that documents the full unified `reasoning` object, off switch included — and steers profiles an earlier build had probed onto Responses back there. The Responses and one-shot request builders in the OpenAI base also go through the same per-provider hooks as streaming chat completions, so a gateway's spelling reaches the wire on every path.

- **Anthropic extended thinking works on Claude 4.7 and newer.** These models reject `thinking.type: "enabled"` with a 400; the request now uses adaptive thinking from the 4.6 generation on, keeps the manual budget for 4.5 and earlier, and never tries to switch Fable / Mythos, which think always. The thinking toggle is also offered for every Claude from 4.5 on, not only the 4.5 pair.

## 0.5.85

### Added

- **An MCP server's `initialize` instructions reach the model.** A server may return an `instructions` string from the `initialize` handshake — its own hint on how its tools are meant to be used. It was parsed and thrown away; it is now captured per server and folded into the chat system prompt, so a server can steer the model's use of its tools without every host writing that guidance into its own prompt.

  The notes are appended after the resolved prompt (default plus the host's `prompt` override, `replace` included) inside a framed block that states they are third-party advice and cannot override the instructions above — the text comes from whatever server the user registered, so it is never spliced in as if it were ours. A note cannot forge another server's attribution either: `<server` / `</server` inside the text and the characters of the server name are both neutralised, so it can neither close its own block early nor open a forged one under a trusted server's name. A server's own name is reduced to an inert identifier before it labels its block, so a name carrying `"><` cannot close its block and re-open one under another server's name and have its notes read as that server's. Each server is guarded at 100 000 characters against a runaway server, a server whose tools were all switched off contributes nothing, and the block is re-assembled on resume rounds so a tool call doesn't wipe it.

  Carried from the connection holder to the engine as `actionArgs.toolInstructions` (`serverType` → text), a new optional field on `ActionArgs`. The UI fills it for browser-run MCP servers; a host driving the engine directly can pass its own. Servers wired through `SystemToolsSource` are not covered yet — their instructions are still discarded.

- **`HelpButton`** — the "i" icon that opens a hint popover on click, exported from the package root and overridable through `ComponentsProvider` as `HelpButton`. It is a popover, not a tooltip: the content may hold links and buttons, the pointer can travel from the icon into it, and it closes on Escape or an outside press. `TooltipIconButton` stays what it was — a hover label — so a hint carrying a link no longer has to be built out of it.

  Consumers building the same hint outside the widget (the ONLYOFFICE plugins render one in the host window) now have a component to use instead of assembling `Tooltip` and `TooltipTrigger`, which are not part of the public surface.

- **`PlatformFileOperations.onRecentFilesChange`** — an optional host subscription that invalidates the "Recent files" submenu. The list was read once when the composer mounted, which is enough where the page reloads with the document, but a desktop plugin panel lives in one iframe for the whole app session: the submenu kept showing the snapshot taken at startup while the user opened and closed documents. The callback carries no payload — `getRecentFiles()` stays the only source of the list, and the widget re-reads it on every signal, keeping the newest answer when a host signals in a burst (one per checked file). Hosts that omit the method behave exactly as before.

- **`--chat-input-max-height` theme token** — the ceiling the composer input grows to before it starts scrolling, falling back to `50vh`, so sizing is unchanged by default. The value was hard-coded, which left `--chat-input-min-height` overridable but its counterpart not; a host embedding the widget in a short container can now cap the input against that container (e.g. `200px`) instead of against the viewport.

### Fixed

- **Copying chat text with Ctrl+C no longer pastes the message bubble's fill.** The browser builds the clipboard's `text/html` by inlining the *computed* style of everything it copies — the widget's classes mean nothing outside it — so a user message arrived at the paste target carrying `background-color` and `color`, and the target applied them: text pasted into a document came with a fill (a solid black one wherever the translucent `--chat-user-message-background` had its alpha flattened) and, out of a dark theme, with white text. The chat root now rebuilds `text/html` from the selection itself with every presentational attribute removed, so the markup — lists, emphasis, code — survives the paste and the chat's own look does not. `text/plain` and the in-widget copy buttons are unchanged.

- **A failing `getRecentFiles()` no longer produces an unhandled rejection, and unusable entries are dropped.** The read was a bare `.then` with the `try/catch` wrapped around `JSON.parse` alone, so a host that rejected the call surfaced an unhandled rejection; the failure is now logged through `logger` and the previously loaded list is kept, since a failed call says nothing about its contents. A `.filter(Boolean)` meant to weed out bad records never removed anything (every object is truthy), so an entry without a `path` rendered as a nameless item that attached nothing — entries are now selected on a non-empty string `path`.

- **The empty new chat scrolls instead of squeezing its content.** `suggestionsHeader`, the welcome screen and the suggestion chips sat outside the thread viewport, so in a short container they were compressed — and, past a point, clipped — with no way to reach them. They now live in a scrollable column that keeps them hugging the composer at a comfortable height and becomes scrollable when they no longer fit.

  The empty state's scroll container is a plain element rather than `ThreadPrimitive.Viewport`: the primitive scrolls itself to the bottom when the thread initializes, which would have hidden the header. The container keeps its `chat-viewport--empty` class, and `welcome-container`, `welcome-title`, `welcome-description` and `suggestions` are untouched, so host overrides keyed on those still apply. A host stylesheet that instead relied on the welcome screen and the chips being siblings of the composer needs updating — they are now nested one level deeper.

- **The "i" hints in the Add model card and in dropdown items now close on Escape and on a click outside.** Both drove a `Tooltip` with `open` but no `onOpenChange`, so the popup could only be dismissed by clicking the icon a second time. Both now render `HelpButton`; the popups look and sit exactly where they did.

## 0.5.83

### Added

- **An expanded tool call names itself and its source.** The card opens with a `Tool call · <name>` title (the display name its card carries on the MCP Servers page) and a `Source:` line above the arguments: a host tool group shows its display name (e.g. `ONLYOFFICE Document Server (MCP)`), a user-configured or host-executed MCP server shows its config name — the same name its card carries on the MCP Servers page — and built-in tools with no such card (web search, image generation) are attributed to `ONLYOFFICE`.

### Changed

- **The tool approval dialog no longer embeds the thread's tool-call card.** It shows the tool's display name (the label its card carries on the MCP Servers page), the same `Source:` line as the expanded card, and the model's one-line intent under it — so the user sees who is about to act and why before choosing Allow or Deny.

## 0.5.82

### Changed

- **An MCP server row switches all its tools with a toggle.** The three-dots menu with Enable all tools / Disable all tools is replaced by a server-level ToggleButton: it reads ON while at least one tool is enabled, and switching it flips every tool at once. Enabling stays blocked under the paid gate while switching off is always available. The orphaned `EnableAllTools`/`DisableAllTools` keys are removed from all 41 locales (DocSpace bug 78693).

- **The thinking block in a message is now labelled "Thinking", not "Reasoning".** The composer toggle that turns the feature on is called "Extended thinking", so the header over the streamed reasoning named the same feature differently. Most locales now reuse the word their own `ExtendedThinking` string already carries; seven (be, fr, id, it, pt-BR, ru, uk) keep a different stem there, since their `ExtendedThinking` wording is itself a reasoning term rather than a thinking one.

### Fixed

- **A registered MCP server no longer connects twice or shows two permission cards in hosts whose backend runs it.** The host's system-tools listing echoes registered custom servers, while the widget also started the same servers in the browser — every server got two cards on the MCP settings page (with the browser connection typically dying on CORS and flashing a crash log). A host whose backend executes the registered servers now declares `PlatformAdapter.customServersExecutedByHost`, which stops the widget from starting or listing them locally; the permission list additionally drops a system echo of a locally listed server. Host-executed servers keep their connection feedback: each registered server shows a loading card until the backend's listing lands, and a server the backend could not reach is flagged with the error icon — clicking the card opens the enumeration error message (`listSystemTools` now answers `{ groups, errors }`; the legacy grouped map is still accepted).

- **Locale typos around the extended-thinking strings.** Catalan carried the Spanish text with a truncated tail (`los coste`), Greek was cut mid-word (`Διευρυμένη σκέψ`), Dutch was left in English, and the Urdu description had no closing full stop.

## 0.5.81

### Changed

- **The thinking block in an assistant message has its own icon.** It shared `btn-extended-thinking` with the composer's Extended thinking toggle, so the same atom glyph stood for both the setting and the streamed reasoning; the in-message header now uses the new `btn-thinking` icon.

### Added

- **`btn-thinking` icon** in light and dark, plus the shared SVG.

## 0.5.80

### Changed

- **The 100-tool cap is gone.** Enabling MCP/host tools is no longer blocked past 100 (102 with web search): the toggles never disable on count, and the "N/100 Tools" counter over the permission list is removed. Users connect as many servers and tools as they want; model/provider limits are theirs to manage.

- **Suggestion chips no longer show a hover tooltip.** The tooltip only repeated the chip's own label, so hovering the empty-thread suggestions flashed a duplicate of the visible text; the chips are plain buttons now.

- **Tooltips no longer fire the instant the pointer touches a button.** `TooltipProvider` now defaults to a 500 ms hover delay instead of `0`, so passing over a row of icon buttons stops flashing a tooltip on each one. This covers every hover tooltip in the widget — the `TooltipIconButton` actions in the header, message action bars and composer, plus the bare `Tooltip` usages that stand in for a native `title` (dropdown items, truncated field errors). Controlled tooltips (`open={...}`) are unaffected.

  The model card no longer wraps its profile name in a tooltip that repeated the visible label.

  `Tooltip` forwards `delayDuration`, `skipDelayDuration` and `disableHoverableContent` to its provider, so a single tooltip can override the default — until now these props reached the Radix root only, where the provider's value won.

- **Text direction now follows the text, not the UI locale.** The composer resolves the direction of each line from its own content (`unicode-bidi: plaintext`), so a message typed in Arabic or Hebrew reads right-to-left even on an English UI, and a Latin draft stays left-to-right on `ar-SA`. An empty field has no content to key off and keeps the locale's direction, so the placeholder sits where the rest of the UI does.

  Message content resolves direction per block: paragraphs, headings, blockquotes, lists and tables are `dir="auto"`, so each part of a mixed-language answer reads correctly on its own instead of inheriting one direction for the whole message. Lists and tables resolve once for the container — items and cells inherit it, so list markers and column alignment stay in a single column instead of alternating edges on mixed-language rows. Table cells default to `text-start` and the blockquote bar to logical `border-s`/`ps`, so both follow the resolved direction. Code is pinned `dir="ltr"` — both fenced blocks and inline spans, since source is read left-to-right inside an RTL answer too. On an inline span that also isolates it, so a `foo()` in an Arabic sentence keeps its brackets instead of handing them to the surrounding bidi run. Only the code itself is pinned: the code block's language label and copy button stay on the side the rest of the UI puts them.

  Non-prose message parts are untouched: tool calls, attachments and the message layout itself (bubble side, action bar) still follow the locale.

- **The settings labels say what the controls do.** "Override for tasks" on the Model assignment page is now "Custom models per task" and carries a description — the rows below it are optional per-task choices layered over the default model, which the old jargon header left the reader to guess. The MCP servers page describes setting servers up rather than configuring and adding them, and the composer's "Web Search" / "Extended Thinking" toggles drop the mid-phrase capital. All 41 locales are updated in step.

## 0.5.79

### Fixed

- **Adding a local OpenAI-compatible provider (LM Studio, Ollama, GPT4All, lemonade & co) works from embedded hosts again.** The model-list clients for these providers were built directly on the SDK constructor and dropped the host's `fetch` proxy, so the request ran inside the webview where `http://localhost` is unreachable (mixed content / CORS). They now go through the shared client factory, which carries the proxy, the extra headers and the keyless-auth handling (DocSpace bug 81388).

- **An unreachable provider URL reports "Failed to connect" instead of "Invalid URL".** The SDK's transport failure ("Connection error.") was aliased to HTTP 404 and rendered as an invalid-URL validation error for addresses that were perfectly valid but unreachable from the current context (DocSpace bug 81388).

- **Allow-always tool permissions are scoped to their server.** The tools-service REST methods stored and matched the bare tool name, so a permission granted for one MCP server answered `true` for a same-named tool of every other server. They now use the same `${serverType}_${toolName}` token the live round and the approval dialog already persist (DocSpace bug 83161).

## 0.5.78

### Fixed

- **Host translation overrides no longer wipe the locale bundle at init.** `initAIChatI18n` merged the host's `resources` with a plain `Object.assign`, so an override object for a locale replaced the whole freshly loaded bundle instead of layering on top of it. A host passing a single-key override for the active language (DocSpace hands one for `EnableWebSearch`) was left with a one-key dictionary, and every other string rendered as its raw key — on English only, because other languages reload their bundle after init while the init-time English bundle is final (DocSpace bugs 83450/83481/83491). Overrides now merge per key over the loaded bundles; overrides for locales without a shipped bundle are kept as before.

## 0.5.77

### Fixed

- **Scrolling all the way to the top of a paginated thread keeps the reading position too.** The hold treated any wheel or touch event as the reader taking over and gave up on compensating — but wheeling into the top edge produces a stream of those events while the page loads, so the one gesture that always reaches the top was also the one gesture that always cancelled the compensation. Stopping short of the edge worked; going all the way up did not.

  The hold no longer bails out on input. A scroll that is not its own re-bases the distance it is holding instead, so the reader is followed rather than fought, and late content still cannot drag them backwards. The compensation is written as an absolute offset, which is what keeps it idempotent where the browser's own scroll anchoring is already doing the same work — anchoring is suppressed at offset zero, which is why the top edge was the only place the missing compensation showed.

## 0.5.76

### Fixed

- **The reading position now survives a page of older messages, not just the request for it.** The hold that keeps the distance to the bottom started counting frames the moment the store grew — but the store grows several commits before the runtime renders what it added, so eight frames of an unchanged height read as "the page has landed", the hold released without moving anything, and the reader stayed at the top of the newly loaded page. It now waits for the content to actually exceed the height it was asked from before it starts compensating, and only then for the height to stop moving; a page that never lands releases the hold on the three-second budget instead of locking the sentinel. The scroll container is also resolved inside the hold rather than read from the effect that runs after it — a viewport the runtime replaced left it writing offsets into a detached node.

## 0.5.75

### Fixed

- **A paginated thread now keeps the reading position when an older page lands, and keeps loading after it.** The compensation ran as a single measurement against the message count and gave up after ~0.6s of frames: a hundred messages of markdown are not laid out that fast, so the measurement found no new height, the reader stayed pinned to the top of the freshly loaded page — the oldest of the new messages rather than the one they were reading — and the sentinel, gated on a compensation that never happened, never asked for another page.

  The sentinel no longer depends on `IntersectionObserver` reporting an intersection that never changes, nor on the viewport it is handed being the element that actually scrolls: it listens for scroll on the resolved scroll container (walking up from the viewport if that one does not scroll), and *holds* the distance to the bottom while the page lays out, re-applying it every frame until the height stops moving. A page that lands without moving the reader anywhere waits for a real gesture before the next request, so a host where nothing can be compensated degrades to one page per flick instead of draining the thread.

## 0.5.74

### Fixed

- **A paginated thread keeps loading past its second page.** The scroll sentinel is gated while a page is pending, and an `IntersectionObserver` reports the intersection state once when it starts and then only on changes — so an intersection that arrived while the gate was closed (the observer restarts on every prepend, and its first report can land before the reading position has been compensated) was dropped for good and the thread stopped loading. Releasing the gate now restarts the observer, which re-reports the current state: the next page is requested if the reader is still within reach of the top edge, and nothing happens if the compensation moved them away.

## 0.5.73

### Fixed

- **Scrolling to the very top of a paginated thread no longer walks the whole history.** The reading position was compensated in a single layout pass keyed on the message count, but the runtime places the prepended page a commit or two later — so the measurement was taken against a list that had not grown yet, the viewport stayed pinned at the top, and the sentinel immediately asked for the next page. The compensation now waits for the page to actually be laid out before restoring the distance to the bottom, and the sentinel is disarmed until that has happened, so one gesture loads one page.

## 0.5.72

### Fixed

- **The widget translates through its own i18next instance again, whatever the host does with react-i18next.** `I18nBridge` resolved `t` through `useTranslation()` with no instance argument, so react-i18next handed it whichever instance the host had in context — or, with no provider at all, the global default the host registered. Both are the host's instance, which knows nothing about the `translation` namespace these strings live in, so every key came back as its own name: a confirmation dialog reading `AIWouldLikeUseThisTool` instead of "AI would like to use this tool:". Hosts that switch suspense off (`react.useSuspense: false`) got no error either — the UI rendered, quietly labelled with raw keys.

  Embedders no longer have to bracket the widget with an `<I18nextProvider>` of the library's own instance to make translations work; doing so is now redundant but harmless.

## 0.5.71

### Added

- **A paginated thread now opens on its newest page and loads older messages as the reader scrolls up.** Until now `enablePagination` bounded the size of each request but not their number: opening a thread drained the whole history page by page, because the storage contract could only walk a thread forward from its first message — 100 round trips for a 10 000-message thread, every time it was opened.

  `MessagesStorage.readByThread` takes a fourth argument for the direction, forwarded by `ThreadsEngine.readMessages` and sent as the `direction` query param on `threads/read-messages`:

  ```ts
  readByThread(threadId, count?, cursor?, direction?: "asc" | "desc")
  ```

  `"asc"` stays the default and every full-history read (the request history of a round, tool-call resume, export) keeps using it. `"desc"` returns the page newest-first with the cursor comparison and both sort keys flipped — `id` included, or messages sharing a timestamp are lost or repeated at a page boundary. See the SQL sketches in `docs/ui/providers/api.md`.

  The message store keeps the loaded window and exposes `hasMoreOlderMessages`, `isLoadingOlderMessages` and `loadOlderMessages()`; a sentinel at the top of the thread pulls the previous page and the reading position is restored after the prepend, so the view does not jump.

- Backends that ignore `direction` keep working. The widget checks whether a page actually came back newest-first (`isDescendingPage`, exported) and falls back to draining the thread forward, so a host that has not implemented the parameter behaves exactly as it did before instead of opening every thread at its beginning.

## 0.5.66

### Fixed

- `PromptsEngine.update` re-validates the prompt name whenever the folder changes, not only when the name itself does — moving a prompt (via `move` or a `folderId`-only `update`) into a folder that already holds a prompt with the same name now fails with `Prompt name already exists in this folder` instead of creating a duplicate pair (Bug 83122).
- `PromptsEngine.importBundle` in `merge` mode no longer overwrites an existing prompt matched by `(name, folderId)`. Merge is now add-only: folders are still matched by name (case-insensitive) and reused, but any prompt-name collision — with existing prompts or between two bundle entries landing in the same folder — fails the whole import with a per-entry `errors` report before anything is written, so a conflicting bundle imports nothing at all (Bug 83130).
- The GPT4All provider's `listModels` no longer swallows connection errors into an empty list. An unreachable server now throws like the other keyless local providers (Ollama, LM Studio), so hosts can answer 502 and the widget shows the failure on the Base URL field instead of a silently empty catalog (Bug 83118).
- Anthropic models listed through an OpenAI-compatible proxy or a test double that omits `display_name` fall back to the model id for `name` instead of returning an unnamed entry (Bug 83119).

## 0.5.65

### Fixed

- The thinking block is rendered again for profiles on the Responses transport. The request asked for a reasoning effort but never for a summary, and `response.reasoning_summary_text.delta` — the only reasoning text that transport emits — is sent solely when the request asks for one, so the stream parser's reasoning branch was unreachable and the model thought silently. The summary is requested only while extended thinking is on (models that ignore `effort: "none"` keep reasoning internally, and an unconditional summary would show a block the user switched off) and only on the streaming path (one-shot callers read `output_text` alone).

  ```ts
  reasoning: { effort: "medium", summary: "auto" }
  ```

- Streaming chat completions now also read the thinking fragment from `delta.reasoning`, the OpenRouter spelling, alongside `delta.reasoning_content`. A non-string value there is ignored rather than stringified into the transcript.

## 0.5.64

### Fixed

- The thread-title request now carries the host entity pair (`entityId` / `entityTitle`) that the chat round already sends, so the ONLYOFFICE provider describes the same agent in its `metadata` on both. `AIEngine.sendWithStream` picks the pair up from `actionArgs` on its own; `ThreadsEngine.openOrCreate` takes it as a new optional `entityMeta` input and `regenerateTitle` as a new optional third argument — a host proxying `threads/regenerate-title` over HTTP must forward that third body element.
- `ToolsEngine.replaceAllCustomServers` now rejects a map whose keys differ only by case. Name lookups are case-insensitive downstream (the DocSpace backend resolves names on a CI collation), so such a pair collided on every read/update/delete while both rows persisted — the second entry was unreachable except by another full replace (Bug 82984).

### Added

- `SystemToolsSource` accepts `servers` as an async resolver `(entityId?) => Promise<Record<string, McpHttpServerConfig>>` in addition to the static map, and threads the active `entityId` into it on every `getTools`/`callTool`. Lets a host back a source with a persisted registry (e.g. per-agent custom MCP servers) instead of a map fixed at construction; nothing is cached, per the class's per-caller correctness rule. `getServerTypes()` returns `[]` for a resolver-backed source. New exported type: `ServersResolver`.

## 0.5.63

### Changed

- The prompt-suggestion chips now show the widget's styled tooltip instead of the native browser `title` tooltip, so the hover text for a truncated chip matches the host's look (Bug 83350).

## 0.5.62

### Fixed

- Tools carrying `enabled: false` are no longer offered to the model. Caller-supplied tools passed through `send-with-stream` (and adapter/built-in tools alike) with the flag set are dropped when the tool context is built, so a disabled tool can't be called, can't produce a stored tool call, and can't pause the stream on approval - per the `TMCPItem.enabled` contract (Bug 83162).

## 0.5.61

### Fixed

- The composer no longer autofocuses on coarse-pointer (touch) devices - opening a chat on a phone or tablet popped the virtual keyboard over the composer before the user asked to type. Fine-pointer devices (including touch-screen laptops) keep the autofocus.

## 0.5.60

### Added

- `composerActionSendBoxSize` widget config — the pixel size of the send / stop button box (the square carrying the accent fill), default `24`. `composerActionSendSize` now sizes only the glyph inside it, so the fill has padding instead of hugging the arrow, and the button is a proper 24x24 target.

### Changed

- The composer's action row is now centred on the 24x24 send button: its height comes from `min-h` on `--chat-input-actions-height` (default raised `20px` → `24px`), so the model selector and its 24px dropdown arrow no longer overflow a shorter row.
- Tool calls now stay in the chat after they finish instead of vanishing. Previously the card was hidden whenever the model had described the call (via `aiChatIntent` or a narration text part), so a reloaded thread showed only prose — with no way to see what ran, with which arguments, or that it failed.
- Restyled the tool-call row to match the design: the tool glyph, then the model's one-line intent as the label, then animated dots while the call runs and a collapse toggle once it resolves. The success tick and the chip background are gone; an error still shows `status.error`. The expanded arguments/result body is unchanged.

## 0.5.58

### Changed

- Reordered the built-in providers in the add-profile dropdown so the popular hosted APIs come first (OpenAI, Google-Gemini, Anthropic, xAI, Stability AI, Deepseek, Mistral, Together AI, Groq, OpenRouter), then the local runtimes (Ollama, LM Studio), then the rest. The previous order was the historical order providers were added in, which put OpenRouter above OpenAI.

## 0.5.57

### Breaking

- `WidgetConfig.renderChatError` is replaced by `formatChatError`, which rewrites the error box's slots as data instead of returning a node. The old hook could only swap the whole content, which forced an all-or-nothing choice: a host that wanted its own wording also lost the Retry button. The new hook returns `{ title?, description?, action? }` — omit a field to keep the widget's default.

  ```tsx
  formatChatError={(payload) =>
    payload.code === "insufficient_funds"
      ? {
          title: t("WalletEmpty"),
          description: t("TopUpToContinue"),
          action: { text: t("TopUp"), onClick: () => goToWallet() },
        }
      : null
  }
  ```

  Renamed rather than redefined in place, so a host still returning a `ReactNode` fails to compile instead of rendering nothing. `ChatErrorContext.defaultText` splits into `defaultTitle` and `defaultDescription`; `ChatErrorOverride` and `ChatErrorAction` are exported alongside it.

### Changed

- `action` distinguishes four intents that a single optional field would collapse: omitted keeps the default Retry, `null` removes the button (for errors a retry cannot fix), `{ text }` relabels Retry while keeping its regenerate wiring, and `{ onClick }` takes over the click entirely. A host-owned action is rendered outside the Reload primitive, so it cannot trigger a regenerate as a side effect. A throw from `onClick` is caught and logged.

## 0.5.56

### Added

- The in-chat error box now carries a **Retry** button. It replays the errored turn through the existing regenerate path, so the failed assistant message is dropped and the last user message is re-run from stored history — nothing is appended to the thread and the error box disappears. Sending from the composer is unchanged: a new message still lands after the error.

  The engine persists the thread and the user message before calling the provider, so Retry also works for a failure on the very first message of a new chat.

- Returning content from `renderChatError` suppresses Retry, on the assumption that the host supplies its own action — a retry is the wrong affordance for the codes worth overriding, since `insufficient_funds` would only fail again. Return `null` for unhandled codes and the default text plus Retry come back.

## 0.5.55

### Changed

- The dark themes fill the in-chat error box too, instead of outlining it — no built-in theme outlines it any more. Their fill is translucent (`#ffbdbd47`) rather than an opaque hex per theme: composed over the three dark page backgrounds it yields `#6c5959` / `#756363` / `#5f4c4c`, holding the design's hue at a consistent lift. The border is still painted (transparent everywhere), so a host can outline the box through `customTheme`.

## 0.5.54

### Changed

- The in-chat error box is now a filled block rather than a bare red outline. Light themes paint the new `--chat-message-error-background-color` and drop the border; dark themes keep an outline and leave the fill transparent. The message is the block's semibold title, with the code as a muted second line.
- `--chat-message-error-color` follows `--text-normal` instead of `--text-negative`. The two are byte-identical in five of the seven themes; the outliers were `white` (`#991b1b`) and `night` (`#f87171`), which rendered the error text red where the block wants a neutral title. `--text-negative` still drives form-field errors, where the red is intentional.

## 0.5.53

### Added

- `WidgetConfig.renderChatError` lets the host take over the *content* of the in-chat assistant error box. It receives the normalized `ChatErrorPayload` and `{ threadId, defaultText }`, and returning a node replaces the default text — so a host can render a localized message with an action (a "Top up" link, a retry button) instead of the provider's raw text. Returning `null`/`undefined` keeps the default; a throw is caught and logged. The box, its `role="alert"`, and the code chip stay library-owned.

  ```tsx
  renderChatError={(payload, { defaultText }) =>
    payload.code === "insufficient_funds" ? <TopUpLink /> : null
  }
  ```

- `onStreamError` now carries `error.code` — the same machine-readable code as the payload — so hosts that only need to react (telemetry, a toast) can branch on it instead of matching message text. Additive and optional.

### Fixed

- HTTP 402 is now classified as `insufficient_funds` instead of falling through to `unknown`, which rendered the provider's raw `402 — insufficient funds to complete this request` in the error box. The code is localized in all 41 locales. A message-based fallback (`/insufficient funds/i`) covers transports that lose the numeric status, and the non-contract `{ type: "error", message }` stream envelope — the main such transport — is now classified rather than hardcoded to `unknown`.

## 0.5.52

### Changed

- Model capability icons in the provider's model dropdown are now shown for OpenRouter only. Everywhere else `Model.capabilities` is inferred from the model id — frequently a blanket `Chat | Vision | Tools` default applied to every entry — so the icons said nothing reliable and are hidden.
- The icon set dropped `vision-ai`; image generation stays, and the `Tools` flag is drawn with the chat icon (`ask-ai`) instead of a separate wrench. Reasoning (`btn-extended-thinking`) is unchanged.

### Fixed

- OpenRouter now derives the `Tools` capability from the catalogue's `supported_parameters` instead of never setting it. Real per-model metadata, so it applies even when the modality fields are absent; `Embeddings` stays exclusive.

  ```ts
  // supported_parameters: ["temperature", "tools"] → Chat | Tools
  ```

## 0.5.51

### Fixed

- OpenAI-family requests now send `content` as a plain string whenever a message holds only text parts, instead of always wrapping it in a content-part array. Strict upstreams rejected the array outright — a text chat routed to Cloudflare Workers AI through OpenRouter failed with `Type mismatch of '/messages/N/content', 'string' not in 'array'`. Arrays are still used when an image is attached; there is no string form for those.

  ```ts
  // before: content: [{ type: "text", text: "hi" }]
  // after:  content: "hi"
  ```

## 0.5.50

### Added

- The ONLYOFFICE provider now marks its streaming chat requests for Anthropic-style prompt caching — `cache_control: {type: "ephemeral"}` on the system prompt and on the last message of the history — so the Claude backend behind the route reuses the static prefix instead of re-reading it every turn. Purely additive: a backend that ignores the field sees an unchanged request.
- The current thread id travels to the ONLYOFFICE route as the `x-session-id` header (`ActionArgs.threadId` → `ProviderCredentials.sessionId`). Merged into the client headers, so `profile.headers` survives; an explicit `x-session-id` there still wins. No other provider receives it.
- Every ONLYOFFICE request — streaming chat, both Responses paths, one-shot actions, image generation — now carries a `metadata` object describing the host entity behind the round. Hosts supply the pair through `actionArgs`; keys they leave out are omitted, and with no entity at all the field is absent. Also threaded through tool-call resumes, so continuation rounds describe the same entity.

  ```ts
  engine.sendWithStream({
    threadId,
    userMessage,
    actionArgs: { entityId: agent.id, entityTitle: agent.title },
  });
  // → body: { metadata: { agent_id: "...", agent_title: "..." }, ... }
  ```

### Changed

- `OpenAIProvider` gained a protected `extraBody()` hook, merged into every request it builds. Empty in the base class, so all other OpenAI-family providers are unaffected; subclasses targeting a backend with its own body parameters override it instead of reimplementing the request builders.

## 0.5.49

### Fixed

- A failed thread rename no longer kills the reply it rides along with. The generated title is persisted from inside `mergeTitleEvents`, i.e. from the generator that is streaming the assistant's answer, and the write was unguarded — so any storage rejection escaped, aborted the round mid-sentence, and (in server-API mode, where the response has already begun) reached the user as a generic in-stream error frame with the partial answer stranded above it. The write is now wrapped: the failure is logged, no `thread-title` event is emitted (showing a name a reload would discard is worse than keeping the placeholder), and the reply streams to its normal terminal event. `ThreadsEngine.regenerateTitle` still throws — there the rename *is* the operation the user asked for.
- Generated thread titles are now capped in code instead of by request. The title system prompt asks for "under 60 characters" on a single line; a weak model returns a preamble, a multi-line list, or the whole answer, and the host then has to store it — DocSpace backs the column with `varchar(255)`, so an oversized title failed the write outright. `generateTitle` now collapses whitespace to one line and truncates at 120 characters, marked with an ellipsis — on the last word boundary that fits, or mid-token for spaceless text (CJK, a URL, a base64 blob), where the cut steps back off a surrogate pair rather than leaving a lone surrogate for storage to reject. What reaches storage is always a plausible title.
- Failed hydration no longer escapes as an unhandled promise rejection. Every hydration path is fired from a mount effect that cannot await it, so a rejected read (offline, 401, 5xx) surfaced only in the console while the UI showed an empty list — indistinguishable from a host that genuinely has nothing configured. All of them now catch, log, and report to the host through `ChatCallbacks.onError` (previously declared but never emitted) as `{ type: "storage", context, error }`, keeping whatever data they already had so the next mount / navigation retries: `profiles:init`, `threads:init`, `prompts:init`, `servers:init`, `tools:list`, and `messages:load` — the last one being the worst of the set, since a failed history read used to blank the open conversation. `clouds:fetch` (a read of the host's own `platform.clouds` adapter) reports as `{ type: "network" }`.
- Locale switches (`I18nProvider`'s effects, `changeLocale`, platform environment changes) no longer reject unhandled when the lazily imported locale chunk fails to load — e.g. a stale build after a deploy. The failure is logged and the widget keeps rendering in its current language. Not routed through `onError`: this provider is mounted independently of `EventsProvider`.

## 0.5.45

### Added

- `HostToolGroup.qualifyNames`: when `false`, the group's tool names are emitted to the model as-is instead of `${group.id}_${name}`. For hosts that mirror an external tool catalog (e.g. DocSpace server tools inside the editor plugin) where the model must see the exact upstream names; the host then owns name uniqueness. Dispatch resolves such groups by exact emitted name (`Servers.getServerType`) and skips the prefix strip (`Servers.toBareName`).

## 0.5.44

### Added

- `AIEngineDeps.webSearchFetch`: optional transport override for the built-in `web_search` / `web_crawling` tools. When omitted the engine keeps routing them through `fetchProxy` (unchanged default). Hosts whose web-search provider sits behind their own bridge (e.g. the editor plugin's `externalFetch` connector transport) can now direct web-search traffic there — web search is not profile-scoped, so it never participates in the per-profile `pickFetch` selection.

## 0.5.43

### Changed

- The add-profile card's import link is now labeled "Import Custom Provider" instead of the generic "Import" (translated in all 41 locales) and is underlined, matching the other field action links like "Get API key".

## 0.5.42 (Desktop plugin changes)

### Added

- `onDeleteThread` widget config — custom confirmation for deleting a chat. When provided, the built-in confirm dialog is skipped and the host owns the confirmation UI (its own modal); the widget performs the deletion once the host resolves `true`. Mirrors `onDeleteProfile` / `onDeletePromptFolder`.
- Suggestion chip height and paddings are now themable: `--chat-suggestion-height`, `--chat-suggestion-padding-x`, `--chat-suggestion-padding-y`.
- Suggestions block bottom margin is now themable: `--chat-suggestions-margin-bottom`.
- User message bubble corner radius is now themable: `--chat-user-message-border-radius`.
- Composer outer wrapper paddings are now themable: `--chat-composer-wrapper-padding-x`, `--chat-composer-wrapper-padding-bottom`.
- Composer box paddings are now themable: `--chat-composer-padding-x`, `--chat-composer-padding-top`, `--chat-composer-padding-bottom`.
- Composer disclaimer text font size is now themable: `--chat-composer-disclaimer-font-size`.
- Composer model-selector combo-box font size is now themable: `--chat-model-selector-font-size` (default `--fs-12`); the dropdown rows inherit it.
- Gap between the action buttons below a message is now themable per side: `--chat-assistant-message-actions-gap` for the assistant's row and `--chat-user-message-actions-gap` for the user's (both default `2px`). Previously only the assistant side honored a token; the user side was hardcoded.
- Icon (and button box) size of the action buttons below assistant and user messages is now configurable: `chatMessageActionsIconSize` widget config (default `20`). Numeric on purpose — the size is handed to the icon component, so an `images` override of one of those glyphs keeps control of how big it draws itself.
- Chat-history title line-height is now themable: `--chat-list-title-line-height` (default `--lh-16`).
- Chat-history search field top margin is now themable: `--chat-list-search-margin-top`.
- Chat-history column paddings are now themable: `--chat-list-padding-x` (shared header/list horizontal inset), `--chat-list-header-padding-top`, `--chat-list-content-padding-bottom`.
- Chat-history thread list top margin is now themable: `--chat-list-items-margin-top`.
- Chat-history date-group header horizontal padding is now themable: `--chat-list-group-header-padding-x`.
- Chat-history date-group block bottom margin is now themable: `--chat-list-group-margin-bottom`.
- Dropdown menu sizing is now themable (both flyout and drilldown modes): `--dropdown-menu-padding-y`, `--dropdown-menu-min-width`, `--dropdown-item-height`, `--dropdown-item-gap`, `--dropdown-item-content-gap`, `--dropdown-item-label-space`, `--dropdown-separator-margin-y`.
- Chat-history thread row height and horizontal padding are now themable: `--chat-list-item-height`, `--chat-list-item-padding-x`.
- `inputIconPosition` widget config (`"start" | "end"`, default `"end"`) — moves the search input's magnifier icon (currently the chat-history search field) to the leading edge, where it stays visible while typing; the clear ("X") button always stays at the trailing edge. `Input` also gained the matching `iconPosition` prop.
- `Input` gap between its children (icon, text, clear button) is now themable via `--input-gap` (default `0`).
- `Input` can now use a different start/end padding when an icon (or clear button) sits on that edge: `--input-padding-start-with-icon` and `--input-padding-end-with-icon`. Both fall back to the base `--input-padding-start` / `--input-padding-end`, so unset hosts keep the current behavior.
- The AI Models, Model Assignment, MCP Servers and Web Search page titles gained a line-height token: `--ai-models-title-line-height`, `--model-assignment-title-line-height`, `--mcp-servers-title-line-height`, `--web-search-title-line-height` (all default `--lh-28`).
- The AI Models, Model Assignment, MCP Servers and Web Search pages gained outer-padding tokens for standalone (non-Settings) mounting — `--ai-models-padding-x` / `-y`, `--model-assignment-padding-x` / `-y`, `--mcp-servers-padding-x` / `-y`, `--web-search-padding-x` / `-y` (all default `0`; inside the Settings tabs the framing still comes from `--ai-settings-margin-*`).
- AI Models page is now themable: `--ai-models-max-width` (default `560px`), `--ai-models-justify` (content column placement — any `justify-content` value, default `flex-start`), `--ai-models-title-font-size` (default `--fs-20`), `--ai-models-title-margin-bottom` and `--ai-models-description-margin-bottom` (default `8px`), and the list gaps `--ai-models-content-gap`, `--ai-models-actions-gap`, `--ai-models-list-gap` (default `8px`).
- Model card spacing is now themable: `--model-card-padding`, `--model-card-gap` (content ↔ actions), `--model-card-content-gap` (logo ↔ labels) — all default `8px`.
- Add/Edit model card spacing is now themable: the add-model heading alignment/size per variant — `--add-model-card-title-align-card` / `--add-model-card-title-font-size-card` (card variant, default `start` / `--fs-12`) and `--add-model-card-title-align-standalone` / `--add-model-card-title-font-size-standalone` (standalone variant, default `start` / `--fs-13`), `--add-model-card-gap`, `--add-model-card-title-margin-bottom`, `--add-model-card-footer-gap`, `--add-model-card-import-gap`, and the Import-help tooltip's `--add-model-card-tooltip-padding`, `--add-model-card-tooltip-gap`, `--add-model-card-tooltip-max-width`.
- Model config form spacing is now themable: `--model-config-form-gap`, `--model-config-form-field-margin-bottom`, `--model-config-form-last-field-margin-bottom`, `--model-config-form-action-height`, `--model-config-form-capability-gap`, and the "Finish AI setup" tooltip's `--model-config-form-tooltip-padding`, `--model-config-form-tooltip-gap`, `--model-config-form-tooltip-max-width`.
- Edit model card spacing is now themable: `--edit-model-card-title-margin-bottom`, `--edit-model-card-provider-gap`, `--edit-model-card-provider-margin-bottom`, `--edit-model-card-footer-gap`, `--edit-model-card-footer-margin-top` (extra gap above the footer, default `0`).
- Add model card footer gains `--add-model-card-footer-margin-top` (extra gap between the form and the footer, default `0`).
- Add/edit model card shell padding is now themable: `--model-config-card-padding` (default `8px`).
- Provider logo sizing is now themable: `--model-card-logo-size` (box, default `32px`) and `--model-card-logo-image-size` (logo image, default `18px`).
- Model Assignment page is now themable: `--model-assignment-max-width` (default `560px`), `--model-assignment-justify` (content column placement, default `flex-start`), `--model-assignment-title-font-size` (default `--fs-20`), `--model-assignment-title-margin-bottom` (default `24px`), and the list rhythm `--model-assignment-description-margin-bottom` (`24px`), `--model-assignment-default-margin-bottom` (`20px`), `--model-assignment-tasks-header-margin-bottom` (`8px`), `--model-assignment-task-margin-bottom` (`12px`).
- MCP Servers page is now themable: `--mcp-servers-max-width` (default `560px`), `--mcp-servers-justify` (content column placement, default `flex-start`), `--mcp-servers-title-font-size` (default `--fs-20`), `--mcp-servers-title-margin-bottom` (default `24px`), and the list body `--mcp-servers-content-padding-bottom` (`32px`), `--mcp-servers-description-margin-bottom` (`8px`), `--mcp-servers-actions-margin-bottom` (`8px`).
- MCP Permissions panel spacing is now themable: `--servers-permissions-margin-top`, `--servers-permissions-padding-y`, `--servers-permissions-header-padding-x`, `--servers-permissions-header-margin-bottom`.
- MCP available-tools list spacing is now themable: `--servers-available-tools-header-height`, `--servers-available-tools-header-padding-x`, `--servers-available-tools-list-gap`, `--servers-available-tools-list-padding-x`, `--servers-available-tools-list-padding-bottom`, `--servers-available-tools-list-padding-top`, `--servers-available-tools-list-padding-top-with-header`.
- MCP tool-group row and its expanded tool list spacing is now themable: `--servers-available-tools-item-height`, `--servers-available-tools-item-padding-x`, `--servers-available-tools-item-content-gap`, `--servers-available-tools-item-chevron-width`, `--servers-available-tools-sublist-gap`, `--servers-available-tools-sublist-margin-top`, `--servers-available-tools-tool-height`, `--servers-available-tools-tool-padding-start`, `--servers-available-tools-tool-padding-end`.
- MCP config editor outer framing is now themable: `--config-editor-padding-y`, `--config-editor-margin-bottom`, `--config-editor-header-padding-start`, `--config-editor-header-padding-end`, `--config-editor-header-margin-bottom`, `--config-editor-content-padding-x`, `--config-editor-body-padding-bottom`, `--config-editor-footer-gap`, `--config-editor-footer-height`.
- Field container spacing/sizing is now themable (shared across settings forms): `--field-container-row-gap` (between the container's rows), `--field-container-control-gap-horizontal` / `--field-container-control-gap-vertical` (label ↔ control per layout), `--field-container-header-gap`, `--field-container-header-margin-bottom`, `--field-container-label-width`, `--field-container-error-height`, `--field-container-error-max-width` (the horizontal error text stays aligned under the control via `label-width + control-gap-horizontal`), and `--field-container-action-height` (the reserved action zone in the horizontal layout). The header icon's size is set numerically instead, via the `fieldContainerIconSize` widget config (default `20`).
- Initial setup screen is now themable: `--initial-setup-max-width` (`560px`), `--initial-setup-justify` (content column placement, default `flex-start`), `--initial-setup-margin` (`12px`), `--initial-setup-list-gap` (`8px`).
- Button geometry is now themable: `--button-height` (`24px`), `--button-min-width` (`40px`), `--button-padding-x` (`8px`), `--button-border-radius` (`4px`), `--button-loader-size` (`16px`).
- Size of the "about"/info icon buttons (the model form's Import help trigger and each dropdown item's about button) is now configurable: `aboutButtonSize` widget config (default `20`). The icon itself can be swapped via the `images` override of `btn-menu-about`.
- Button text font-weight is now themable per variant: `--button-font-weight` (primary, default `700`) and `--button-default-font-weight` (default variant, default `400`).
- ComboBox arrow icon is now configurable, independently for the settings-form comboboxes and the composer's model selector: widget config `comboBoxArrowIcon` / `modelSelectorArrowIcon` (both default `"arrow"`; supply a custom asset through the `images` override). `ComboBox` also gained an `arrowIcon` prop; both arrows render at a fixed `7` × `4`.
- ComboBox is now themable: search-header `--combo-box-search-padding-x` (`8px`), `--combo-box-search-padding-bottom` (`4px`); search input `--combo-box-search-input-height` (`24px`), `--combo-box-search-input-padding-x` (`4px`); dropdown arrow container `--combo-box-arrow-container-width` (`16px`).
- Web Search page is now themable: `--web-search-max-width` (default `560px`), `--web-search-justify` (content column placement, default `flex-start`), `--web-search-title-font-size` (default `--fs-20`), `--web-search-title-margin-bottom` (default `24px`), and the form gaps `--web-search-gap` (page variant, `8px`), `--web-search-tab-gap` (tab variant, `16px`), `--web-search-fields-gap` (`8px`), `--web-search-actions-gap` (`8px`).

### Fixed

- Field container's horizontal-layout error text now indents on the logical start edge (`ps-*`), so it lines up under the control in RTL too (was a physical left inset).
- The Add/Edit model form now keeps uniform spacing in the horizontal layout regardless of whether a field has an action link. `FieldContainer` gained an opt-in `reserveActionSpace` prop (used by the model form) that reserves a fixed-height action zone (`--field-container-action-height`) above each field, so a link like "Get API key" appears/disappears inside it without shifting the layout — previously only the API-key field reserved that space (via a spacer), making the Provider→API-key gap larger than the rest. Other horizontal `FieldContainer` usages (e.g. Model Assignment, Web Search) are unaffected. In the vertical layout that spacer only made the API-key header taller than the other fields (the label already sets the row height), so it was dropped and the headers now line up.


## 0.5.41

### Fixed

- **A streaming round no longer leaks its output into another chat.** Switching the active thread mid-stream — a host re-scope via `entityId` (e.g. navigating between sections), a sidebar thread switch, or an explicit new chat — now detaches the in-flight round: it keeps draining so the engine finishes and persists the reply, but stops writing display updates. Previously an image generation started before navigating away resurfaced as a lone assistant message inside the fresh empty chat, with the prior history seemingly gone (it was intact in the original thread all along). The busy flags reset on the switch so the composer unblocks immediately, and a late `thread-title` can no longer hijack the new scope's thread list.

## 0.5.40

### Changed

- **The image-generation placeholder is now alive under the pointer.** The static "Creating image" label is replaced with a running m:ss elapsed timer (the label moved to `aria-label`, so the placeholder still announces itself), and moving the pointer over the box spawns expanding rings in the halftone masks — the dots ripple out from the cursor. Rings are throttled by time and distance and capped, so a fast sweep can't flood the masks. Dot radii are finer and layer opacities slightly higher.

## 0.5.39

### Fixed

- **No more raw tool-card flash while a call's arguments stream in.** Mid-stream `argsText` is an unparsable JSON prefix, so the `aiChatIntent` label wasn't readable yet and the fallback card flashed before switching to the intent line. While arguments stream, the widget now shows the pending view instead — the animated placeholder for `generate_image`, animated dots for other tools.

## 0.5.38

- Package re-release of 0.5.37, no source changes — an earlier 0.5.37 tarball predated the i18n sweep, so the version is bumped to guarantee hosts pick up the final package.

## 0.5.37

### Added

- `profilePickerReadOnly` widget config — the composer shows the current profile as a plain read-only label (secondary color, combobox text metrics, no dropdown arrow) instead of the interactive picker. Implies the picker area is visible, so the `entityId` default-hide heuristic does not apply; an explicit `hideProfilePicker: true` still hides everything.

```tsx
<AIChatWidget profilePickerReadOnly ... />
```

### Fixed

- **i18n sweep across all 41 locales.** Added the missing `CreatingImage` / `Uploading` translations; localized previously hardcoded UI strings (Model field label, "All tools" toggle, MCP config JSON errors, profile create/update errors, default `Chat Export` filename, composer / scroll-to-bottom / logo / dialog a11y labels); removed 5 dead keys (`Ask`, `AskAI`, `Close`, `Name`, `ToolExecuted`).

## 0.5.35

### Changed

- **The `aiChatIntent` line shows whenever it's present, even next to a lead-in text part.** It now takes precedence over the "model narrated in text" hide, so a described call always renders its intent sentence + animated dots while it runs (not just bare dots).

## 0.5.34

### Fixed

- **Animated progress now shows during a narrated tool call.** When the model writes a lead-in sentence before a tool call (common with server-side tools), the call trails animated dots while it runs instead of rendering nothing — the wait no longer looks frozen.

## 0.5.32

### Fixed

- **The tool-call intent line is now visible while the call runs.** It was gated on a "tool pending" flag that stays set through execution, so it never surfaced before the answer arrived. It now animates across the whole in-flight window (arg streaming, approval, execution) and hides once the result is in.

## 0.5.31

### Changed

- **The tool-call intent line appears only while animating.** It shows during the live in-flight window with the progress dots and nothing otherwise (completed calls, loaded history, approval, image generation). The confirmation dialog still renders the full tool-call card.

## 0.5.30

### Fixed

- **The approval dialog shows the full tool-call card again.** Outside a chat message runtime (the confirmation dialog), a described tool call now renders its tool name and arguments for review instead of the one-line `aiChatIntent` status — the intent view is reserved for the message list.

## 0.5.29

### Changed

- **A described tool call shows only while it runs.** The `aiChatIntent` line now trails animated dots as a "still working" cue and hides once the call completes (the model's answer follows). Approval and image generation keep their own indicators.

## 0.5.28

### Changed

- **Described tool calls render as plain text, not a card.** When a tool call carries an `aiChatIntent` description, the chat shows just that sentence as a regular paragraph (same size/line-height as chat text) in muted `--text-tertiary`, with vertical spacing — no icon, pill, chevron, or collapsible body. The full tool-call card is kept only for calls without a description.

## 0.5.24

### Changed

- **Tool calls now carry their own description.** Every tool schema sent to the model gains a required `aiChatIntent` argument (one short sentence describing the call). The engine strips it before executing the tool — both core-side and UI-side, covering the remote-core deployment — and the chat renders it as the tool-call label. This replaces the old "narrate before the call" system-prompt instruction, tying the description 1:1 to its call instead of detecting it from a preceding text paragraph. The previous narration / hidden-card path remains as a fallback when the field is absent.

## 0.5.22

### Added

- `showWelcome` / `welcomeTitle` / `welcomeDescription` widget config — control the welcome screen at the top of a new (empty) chat. `showWelcome` is opt-in (hidden by default, set to `true` to render it); the `ThreadWelcome` component reads the flag itself and renders nothing when it is unset. `welcomeTitle` / `welcomeDescription` override the built-in localized strings (`WelcomeTitle` / `WelcomeDescription`) with host-supplied, untranslated text — omit either to keep its built-in string.

```ts
<AIChatWidget
  showWelcome
  welcomeTitle="How can I help?"
  welcomeDescription="Ask me anything about your documents."
/>
```

- **Attachments carry optional form-analysis metadata.** The `Attachment` interface gains `canAnalyze` and `formKeys` (analyzable forms and their field keys), and `addAttachmentFile` now returns the created records so callers can read that metadata.

## 0.5.21

### Fixed

- **The user's message now appears in the chat instantly on send.** It's rendered optimistically with a stable client id the moment `onNew` fires, instead of waiting for the engine's `user-message-stored` event — which sat behind the tool-list refresh, profile resolution, and a full history read (visibly slow when an MCP server is connecting or the core runs on a remote host). The stored version reconciles in place, keeping the client id so assistant-ui never re-keys the message (no phantom branches). Same behaviour whether the core is in-process or on a remote Express host that assigns its own message ids.

## 0.5.20

### Added

- **Attachments appear in the composer the moment they are picked, as loading chips.** New `pendingAttachments` state in the attachments store, driven by a lease model: `beginPendingAttachments(inputs)` synchronously reserves placeholder chips (and their slots in the 5-item cap — a pending file can no longer let a 6th one through) and returns lease ids; `addAttachmentFile` / `addAttachmentImage` accept `options.pendingIds` to consume those leases, swapping placeholder → real chip in a single state update. Without `pendingIds`, the add actions self-reserve, so every caller gets the loading state for the storage round trip for free. `failPendingAttachments(ids)` drops leases whose production failed; `cancelPendingAttachment(id)` backs the ✕ on a loading chip (revokes the lease — the settle then discards the ref and deletes the orphan storage record; the underlying production is not aborted). `clearAttachmentFiles` / `clearAttachmentImages` revoke their bucket's leases, so a thread switch mid-upload no longer lands a chip in the newly opened draft.
- **`PendingFileItem` component** — the loading chip: same box as `FileItem` (shared `chipClassName`, so the swap is visually seamless), file icon + name, an indeterminate `Loader` (host-overridable slot) where the close button sits, ✕ on hover, `role="status"`/`aria-busy`. Exported for hosts. New i18n key `Uploading`.
- **The library's own attach paths reserve before the slow part.** Local/recent file pickers reserve before `convertFileToText`, the image picker and drag-and-drop before the `FileReader` read — the reservation also replaces the hardcoded slice-to-5 as the cap check, so payloads past the cap are no longer produced at all. Zero-byte files are filtered before reserving and never flash a chip.
- **Send is blocked while an attachment is uploading** (button disabled with an "Uploading…" title, Enter guarded in the composer) — sending mid-upload would have silently dropped the attachment the user just watched appear.

## 0.5.13

### Changed

- **The model now narrates each tool call in natural language.** The chat system prompt instructs the model to write one short sentence — in the conversation's language — describing what it is about to do before every tool call. The line arrives as ordinary assistant text (a text part before the tool-call part). The same rule is mirrored into the text-protocol fallback path (`profile.canUseTool === false`).

```text
Whenever you call a tool, first write exactly one short sentence … then make the tool call.
```

- **Tool-call cards are hidden when the model narrated the call.** In the transcript, a tool-call card is suppressed when a non-empty text part precedes it in the same message — the narration replaces the redundant card. Calls with no preceding text still show the card (fallback for models that don't narrate), and a generated image is always kept even when its card is hidden.
- **Image generation shows an animated halftone placeholder.** While `generate_image` runs (or its stored image is still hydrating), a full-width card is shown: a static "Creating image" label in a clean strip on top, and below it a halftone field of three dot layers (small/medium/large dots, denser the larger). Colours are theme-driven — dots paint in the message text colour at rising opacity over a themed surface — so it adapts to light/dark with no hardcoded values. Each layer is revealed only through a soft radial "blob" mask, and the three blobs slowly wander along Lissajous paths with per-axis periods in the 7–13s range, deliberately not integer multiples of one another, so the motion never resolves into a visible loop. Dots stay a fixed pixel size at any card width (a `ResizeObserver` feeds the live size to one rAF loop). Then swapped for the finished image; respects `prefers-reduced-motion`; skipped on failure.

## 0.5.6

### Changed

- **Custom-provider import link moved into the Provider field.** The "Import" link — and its hint tooltip with "Download template" — now sits in the Provider field's action row (mirroring "Get API key"), instead of the Add-model card footer. The ONLYOFFICE AI Settings link keeps priority in that slot when shown. Behaviour is unchanged.

## 0.5.5

### Fixed

- **A call to an unavailable tool no longer hangs the turn.** When the model calls a tool that is not in the current list — a hallucinated name, or one switched off mid-thread (Web search toggled off, an MCP server removed) — the engine resolves it in-engine with a "not available" error and continues the chat. Previously it surfaced a phantom approval whose approval threw and left the turn stuck (spinner never cleared, no resume). Single chokepoint, so it covers the browser UI and the OpenAI-compatible endpoint alike.

```jsonc
// fed back as the tool result, then the model recovers on the same turn
{ "error": "Tool \"web_search\" is not available." }
```

## 0.5.4

### Fixed

- **MCP HTTP sessions are now terminated instead of orphaned.** The custom-server client captures `Mcp-Session-Id` from `initialize`, echoes it on every follow-up request, and closes the session with an `HTTP DELETE` on server delete/restart. Stateless servers (no session id) are unaffected.
- **Widget teardown cleans up MCP servers.** On unmount the widget disposes all custom servers — stdio child processes are terminated, HTTP sessions closed, and in-flight tool calls rejected instead of leaking until their 30s timeout. Previously nothing ran on unmount, so stdio processes and sessions were left orphaned.

```ts
// on server delete / restart / widget unmount
DELETE <server-url>   // header: Mcp-Session-Id: <id>
```

## 0.5.3

### Changed

- **MCP crash logs moved into the server row.** When a custom MCP server stops, its error icon is now clickable: clicking the row (or the icon) expands a dropdown — same affordance as the tools list — showing that server's log instead. The panel is capped at 300px height and scrolls. Replaces the previous separate "show logs" button. Stopped-state and logs are read synchronously on mount, so an already-stopped server opens its log on the first click without waiting for the status poll.

## 0.5.1

### Changed

- `ThreadsCursor` now carries an `id` field mirroring `threadId`, so a backend whose keyset tiebreak column is named `id` can read it straight from the cursor. The widget always sets `id === threadId`, so the threads keyset (`lastEditDate DESC, threadId DESC`) and the SQL sketch in `docs/` are unchanged — the field is additive and old servers keep working.

```ts
// cursor sent to threads/list
{ lastEditDate, threadId, id } // id === threadId
```

## 0.5.0

### Added

- **Cursor (keyset) pagination for threads and messages, behind the global `enablePagination` flag** (default `false` — without it no pagination parameters are ever sent, behavior is identical to 0.4.x).
  - `threads.readAll(entityId?, count?, cursor?, query?)` and `messages.readByThread(threadId, count?, cursor?)` — same methods, optional keyset params; page size is 100. Cursor types (`ThreadsCursor`, `MessagesCursor`), `PAGE_SIZE`, cursor builders, and the `drainPages` page walker are exported for hosts.
  - With the flag on: the sidebar loads 100 threads and infinite-scrolls; every full-history read (opening a thread, building the model's request history, tool-call resume, download/export) fetches in pages of 100 — same complete result, bounded requests.
  - **Sidebar search goes to storage**: typing (debounced 300ms) sends `query` — a case-insensitive title substring, applied server-side BEFORE pagination — and the result pages through matches with the same cursor scheme. A backend that ignores `query` is detected by a non-matching title in the response; the widget then permanently falls back to draining all pages and filtering client-side, so search stays complete either way.
  - Engines accept `pagination?: boolean | (() => boolean)` in deps (`ThreadsEngine`, `AIEngine`) for headless/Express hosts; `createStores` takes `enablePagination`.
  - Adapters/backends that ignore the new params keep working: the widget detects a full dump (or a cursor-ignoring backend) and stops paging.

```tsx
<AIChatWidget enablePagination />
```

### Breaking (only when enabling the flag)

- `threads/read-messages` route query params renamed: `limit`/`startIndex` → `count`/`cursor` (`cursor` is a JSON-encoded keyset object). Backends must honor `count`/`cursor` on `threads/list` and `threads/read-messages` before turning the flag on — see the "Cursor pagination on the server (Express)" section in `docs/ui/providers/api.md` for query parsing, SQL keyset patterns, and recommended indexes.
- `MessagesStorage.readByThread`'s third parameter changed type: `startIndex: number` → `cursor: MessagesCursor`. With the flag off the parameter is never passed.

## 0.4.183

### Changed

- Attached images are now sent with an explicit `detail: "high"` on both OpenAI transports — chat completions (`image_url.detail`, previously omitted) and the Responses API (previously `"auto"`). This guarantees the tiled high-detail pipeline (input capped at 2048px on the longest side) and prevents OpenAI-compatible backends from falling back to processing the original-size image. Applies to every OpenAI-family provider; Anthropic/Gemini/Mistral have no such parameter.

## 0.4.182

### Added

- Host-configured `suggestions` now also appear in the composer's prompts dropdown as a virtual folder named `built-in-prompts` (fixed identifier, not translated; exported as `BUILT_IN_PROMPTS_FOLDER`). Clicking an entry inserts its prompt into the composer. The folder and its entries are read-only: no edit/move/delete on the rows, no rename/delete on the folder, and regular prompts can't be moved into it. The prompts button is shown even when only suggestions exist.

## 0.4.181

### Fixed

- Adding a model no longer leaves the save button spinning forever when the profile was actually created (e.g. adding an Ollama profile — persisted server-side, but the widget list only showed it after a page refresh). Any failure escaping the create/update round trip (non-JSON or empty response body, non-2xx status, a response without the `profile` field) threw between the form's `isSubmitting(true/false)` calls, so the spinner never reset and the new profile was never inserted into the store.
  - `addProfile` / `editProfile` never throw anymore: transport and response-shape failures are normalized to a form error.
  - A `success` response without a profile body now resyncs the list from storage, so the model appears immediately.
  - The Add/Edit forms reset their spinner in a `finally` and surface unexpected errors in the form instead of an unhandled rejection.

## 0.4.180

### Fixed

- The loader no longer reappears (and the composer no longer stays locked) after the reply finishes while the auto-generated thread title is still pending. The engine used to await the title only after the chat stream, so a slow or hung title request held the whole round open; the title request has no timeout, so this could hang indefinitely (most visible with single-slot local providers like Ollama/LM Studio, or SDK retry backoff).
  - The title is now multiplexed into the stream: `thread-title` is yielded between chunks the moment it resolves (the common case — the title request starts before the chat request).
  - If the reply ends first, the round closes immediately and the thread keeps the default "New chat" title for good — a late title is discarded rather than applied out-of-band. A round paused on a tool call isn't over, so there the title still arrives as a trailing event.
  - The UI releases its busy state on the terminal event (`message-end` / `message-incomplete`) instead of the generator's end, and keeps draining the stream tail in the background.

## 0.4.179

### Fixed

- Anthropic replies are no longer truncated when Extended Thinking is on. The thinking budget (10k) is carved out of `max_tokens`, but the cap was set to 16000 — leaving only ~6k tokens for the visible reply (vs 30000 without thinking). Thinking requests now use `max_tokens: 32000` (the smallest max-output limit among thinking-capable Claude models, safe everywhere), giving the reply 22k tokens of headroom. Applies to both streaming chat and one-shot actions; non-thinking requests are unchanged.

## 0.4.178

### Fixed

- Clicking "+" (attachments), the prompts button, or an attachment's remove cross in the composer no longer sends the typed message. The composer is a `<form>`, and `IconButton`/`Button` rendered a bare `<button>` without a `type` — which defaults to `type="submit"` inside a form. Both components now default to `type="button"` (an explicit `type` prop still wins; `asChild` buttons are untouched). Send/Stop and Enter-to-send are unaffected — they don't rely on implicit form submission.

## 0.4.177

### Changed

- Picking a model in the chat composer now also updates the persisted Chat model assignment ("AI chat" in model settings) — only when the widget runs without an `entityId`; an entity-scoped widget keeps composer picks session-local. The initial auto-select, restoring a thread's model on open, and host-defined profile-picker actions (agent aliases) remain session-only. The host receives the usual `onModelAssignmentUpdated` (`task: "chat"`) and `onCurrentChatProfileUpdated` (`scope: "persisted"`) events.

## 0.4.176

### Fixed

- The first message of a new thread no longer reaches the provider with the image as a raw ref marker instead of inline base64. The thread-title request (`generateTitle`) was the only provider-bound call built from the un-hydrated user message — and it fires exactly once per thread, on the first message (built-in providers' safety guard then dropped the image, so the title model never saw it; a host-registered provider received the ref JSON verbatim). All three title paths now resolve attachment refs before the provider call: `AIEngine.sendWithStream`, `ThreadsEngine.openOrCreate`, and `ThreadsEngine.regenerateTitle` (which reads the stored first message — persisted in ref form).
- `sendWithStream` shares a single hydration pass between the title and chat requests, so a remote storage adapter pays one `readManyByIds` round trip per send instead of two.

## 0.4.173

### Fixed

- LaTeX written with `\(...\)` (inline) and `\[...\]` (display) delimiters now renders. Many models emit these instead of `$...$` / `$$...$$`, and `remark-math` only recognizes the dollar forms, so the formulas showed as raw text. Both markdown renderers now normalize `\(...\)` → `$...$` and `\[...\]` → a display `$$...$$` block before parsing (code spans are left untouched); the assistant-streaming path uses `MarkdownTextPrimitive`'s `preprocess` hook.

## 0.4.172

### Fixed

- Sending a message or opening a chat from history no longer crashes the host with `Unable to preload CSS for .../dot.css` (404). The Markdown/KaTeX peer-dep stylesheets were imported dynamically inside the lazy markdown boundary, so a consumer's bundler shipped them as `__vitePreload`-guarded chunks that reject and tear down the markdown Suspense tree when the CSS asset 404s. They are now imported statically (bundled into the host's main stylesheet, loaded via a plain `<link>`); the heavy markdown JS stays lazy.

## 0.4.165

### Fixed

- The chat model no longer resets to the default after approving or denying a tool call. Every request that resumes a thread (tool approve/deny and the in-stream auto-continue paths) now carries the active `profileId`, and — for a separately-deployed `core` — `AIEngine` recovers the thread's own persisted profile when a caller omits `profileId`, instead of falling back to the global default-model assignment.

## 0.4.164

### Changed

- The Web Search settings page can now be fully restyled by the host through the `className` prop and the stable `web-search-*` classes (`web-search-root`, `web-search-fields`, `web-search-field-header`, …): field-column gaps and `max-width`, header label size/weight, and the "Get API key" link color (via `--link-secondary-color`) — all from the host's own stylesheet.
- **Provider registry is now lazy — breaking API change.** Each built-in provider SDK (`openai`, `@anthropic-ai/sdk`, `@google/genai`, `@mistralai/mistralai`) loads on demand via dynamic import, so a consumer bundles only the SDK(s) it actually uses instead of all four. As a result `createProvider(type, creds)` and `providerFor(...)` are now **async**, and the sync `getProvider(type)` is replaced by `loadProvider(type)` (async, returns the class) plus `getProviderMetadata(type)` / `getProviderName(type)` (sync — name + base URL, no SDK loaded).

```ts
// before: const p = createProvider("openai", creds);
// after:  const p = await createProvider("openai", creds);
```

- Smaller published package and lighter runtime bundle: sourcemaps are no longer shipped and output is minified (tarball ~1.3 MB → ~0.5 MB), `.d.ts` are rolled up, and CodeMirror + the syntax highlighter now load lazily.
- Streaming is cheaper end to end: per-token persistence is coalesced, providers no longer emit redundant identical snapshots, and streaming assistant text renders through the block-memoized markdown path.
- Fewer redundant requests: system MCP servers reuse their session and cached tool list, provider model lists are cached (and reused as the credential-validity signal on save), and the guaranteed-404 Responses-API capability probe is skipped for non-OpenAI providers.
- Fewer duplicate/concurrent requests on the client: `ProfilesStore.init()` and the servers `getTools()` fetch now coalesce concurrent callers, so several page mounts share one load instead of each firing 2–3×; the redundant widget-level profile init was dropped; and the remote API transport pools in-flight identical `GET` reads.
### Added

- `onDropFiles` widget config — takes over file drag-and-drop onto the chat surface. When provided, dropping one or more files hands the raw `File[]` to the callback and the built-in handling (reading images as data URLs / text files as text and attaching them in-memory, silently ignoring binary Office/PDF drops) is skipped entirely. Use it to route every dropped file through the same path as the composer's upload button — e.g. a host that uploads to portal storage and attaches by file id, which also lets binary formats (DOCX/PDF/XLSX) be dropped. The drag-over highlight/overlay is still driven by the widget; only the drop's payload handling is delegated. Omit to keep the built-in read-and-attach behavior.

```ts
<AIChatWidget onDropFiles={(files) => host.uploadAndAttach(files)} />
```

## 0.4.163

### Fixed

- Image attachments now reach the provider as inlined `data:image/*;base64,…` on every dispatch path. `resolveAttachmentRefs` (which hydrates the persisted image ref into base64 via the host storage adapter) ran only on the streaming chat paths; the one-shot `AIEngine.send` (Vision/OCR/Summarization/Translation/TextAnalyze) and `AIEngine.sendCustom` (custom/arbiter flows) shipped the raw ref JSON — or a host pre-signed URL — so vision models couldn't see the image. Both paths now resolve refs before the provider is called.
- Provider adapters harden the image path as a safety net: the Anthropic / OpenAI / Responses / GenAI / Mistral converters now require a base64 `data:` URL and drop the part (or substitute an inert placeholder) with a warning if the value is still a ref or an http(s) URL, so a non-inlined image can never be forwarded to a provider.

## 0.4.160

### Fixed

- Code blocks rendered through `MarkdownContent` (the plain `react-markdown` path used by assistant messages) now get the full block UI — language header, copy button, and shiki syntax highlighting — instead of rendering as bold-italic inline code. The shared components map was written for assistant-ui's `MarkdownTextPrimitive`: its `SyntaxHighlighter` / `CodeHeader` keys are ignored by plain react-markdown, and `useIsMarkdownCodeBlock()` is always false outside assistant-ui's context, so every fenced block fell through to the inline-code styling. `MarkdownContent` now uses its own `plainMarkdownComponents` map whose `pre` / `code` renderers detect blocks by the `language-*` class or multiline content and rebuild the same CodeHeader + shiki composition without assistant-ui context. The `MarkdownText` (assistant-ui) path is unchanged.

## 0.4.159

### Fixed

- Code-block syntax highlighting now works under every theme, not just `theme-light` / `theme-dark`. The shiki palette switch was hardcoded to those two theme ids, so under the other built-in themes (`theme-white`, `theme-gray`, `theme-classic-light`, `theme-night`, `theme-contrast-dark`) and any custom host theme the CSS never matched and tokens fell back to shiki's inline `color: light-dark(...)` — which always resolves to the light palette (nothing sets `color-scheme`), leaving code unreadable on dark themes. `ThemeProvider` now stamps the resolved theme classification on its wrapper as `data-theme-type="light" | "dark"` (derived by `getThemeType`, so custom ids like `theme-portal-dark` classify correctly), and the palette-switch CSS keys off that attribute instead of specific theme ids.

## 0.4.156

### Fixed

- `hideProfilePicker` is now tri-state and an explicit value from the host always wins: `true` — the composer's model picker is always hidden, `false` — always shown (even with `entityId` set), omitted — hidden only when `entityId` is set (legacy heuristic). Previously `entityId` was an unconditional veto (`hideProfilePicker || entityId !== undefined`), so hosts that scope every chat by entity lost model selection everywhere with no way to opt back in.

```ts
<AIChatWidget entityId={roomId} hideProfilePicker={false} /> // picker stays visible
```

## 0.4.154

### Fixed

- Stop button now actually aborts streaming in server-API mode (`createServerAPI`). The caller's `AbortSignal` is wired onto the `fetch` itself (closing the connection is the only cancellation the backend can observe) and stripped from the JSON body, where it used to serialize as a meaningless `{}`. An abort ends the NDJSON stream gracefully instead of surfacing as a stream error.
- The UI stream loop now exits as soon as Stop is pressed and finalizes the partial message as stopped by the user (`status: { type: "incomplete", reason: "cancelled" }`) rather than an error — the message stops growing immediately and a new message can be sent right away.
- Tool-call continuation streams (approve / deny, including server-executed tools) are now abortable too: dialog-driven approve/deny arms a fresh `AbortController` for the resume round — previously they reused an already-cleared controller (or passed no signal at all), so Stop had nothing to abort during post-tool continuations in either mode.

## 0.4.152

### Fixed

- Composer attachments are no longer wiped when the thread view remounts with the same thread — including the empty "new chat" state (`threadId === ""`). The message-sync effect could never "claim" the empty thread id, so every remount of `Thread`/`ChatPage` re-fetched history and cleared just-added attachments. `_currentThreadId` now starts as a `null` sentinel and the claim covers `""` too: the first mount still fetches, remounts with the same (possibly empty) thread are no-ops, and switching to a different thread still clears attachments and loads the right history.

## 0.4.151

### Added

- "Reset settings" button on the Web Search settings page, shown alongside "Save" in button save-mode (`webSearchSaveMode: "button"`). It clears the persisted web-search config (`api.webSearch.clear`) and restores the form to its defaults — provider back to the first built-in engine, empty API key / base URL. It's a secondary button (`variant="default"`) and is disabled when there is nothing to reset (no saved config and an empty form). New `ResetSettings` translation key added across all locales. The Web Search page also gained stable host-targetable classes for styling: `web-search-root` (the component's root container), `web-search-fields` (the field rows group), `web-search-field-header` (each field's header label), `web-search-actions` (the Save/Reset button row), `web-search-save-button`, and `web-search-reset-button`. The exported `WebSearchPage` additionally accepts a `className` prop, merged onto its root element with `tailwind-merge` (so passed utilities override the built-in ones) for host styling of the page.
- Per-dialog sizing tokens for the prompt-management and confirmation dialogs, each with a built-in fallback so layout is unchanged by default. Two groups: `*-dialog-body-padding-y` sets the vertical padding of the dialog's body wrapper (the area above the footer) — `--new-folder-dialog-body-padding-y`, `--edit-prompt-dialog-body-padding-y`, and `--rename-folder-dialog-body-padding-y` (default `32px`); and `*-dialog-message-height` sets the height of the single-line confirmation message row — `--delete-chat-dialog-message-height`, `--delete-folder-dialog-message-height`, and `--delete-profile-dialog-message-height` (default `40px`). They're usage-only tokens with inline fallbacks (not declared in the theme files), so hosts tune individual dialogs via host CSS or `customTheme` without affecting the rest of the widget.
- `DialogFooter` is now the shared dialog footer with actions — a right-aligned, RTL-aware button row with a secondary "cancel" button and a primary "submit" button. The previous children-only `DialogFooter` (an unused generic flex wrapper) is replaced by this props-driven implementation, and the four hand-rolled footer copies in the prompt dialogs (new-folder, edit-prompt, rename-folder, delete-folder confirmation) now use it. Props: `cancelLabel`/`onCancel`/`cancelType`, `submitLabel`/`onSubmit`/`submitType`/`submitDisabled`, plus `className` (wrapper) and `buttonClassName` (both buttons). Hosts can replace the whole footer via the existing `DialogFooter` key in the `components` override map (`DialogFooterProps` is exported, now describing the button props instead of `div` props). DocSpace registers a `DialogFooter` override in `@docspace/ui-kit` that renders the footer with the DocSpace ui-kit `Button` (primary submit + secondary cancel, both full-width).
- Web Search settings can now be saved via an explicit Save button instead of the implicit save-on-blur. New `webSearchSaveMode` widget config (`"blur"` default, or `"button"`) — in `"button"` mode input blur and cloud-provider selection only update local state (blur still validates the base URL), and a Save button (localized `Save`) at the bottom of the form performs the write; it shows a loading spinner while persisting and stays disabled until the form differs from the last persisted config (so it disables again after a successful save). `"blur"` mode is unchanged (no button, saves on blur/select as before). Also overridable per instance via the new `saveMode` prop threaded through `Settings` → `WebSearchPage` → `WebSearch`. New `onWebSearchSaved` chat callback (payload identical to `onWebSearchUpdated`: `{ enabled, provider, isCloudProvider? }`) fires whenever the config is persisted, in both modes.
- `composerDisabled` widget config — disables the composer entirely: the input becomes non-editable (no typing, no Enter-to-send) and every composer control (attachments, prompts, model selector, send) is made non-interactive (`pointer-events-none`) and dimmed. The composer root also gains a `composer-disabled` class for host CSS targeting. Pair with `composerHeader` to explain why (e.g. an "AI features aren't active" banner). Defaults to `false`.
- `composerHeader` widget config — arbitrary host content rendered directly above the composer, in both the empty and non-empty chat states. Use it to inject a host-owned banner or notice (e.g. an "AI features aren't active" call-to-action). Spans the composer's width and carries a stable `composer-header` class for host CSS targeting; the host owns the markup and styling. Omit to render nothing.
- Floating "scroll to bottom" button in the chat thread (built on `ThreadPrimitive.ScrollToBottom`). It sits just above the composer, appears only while the thread is scrolled up, and hides itself once the user is back at the latest message. Shown by default; the new `hideScrollToBottomButton` widget config removes it entirely. Its geometry is token-driven on `.aui-root` — `--chat-scroll-to-bottom-width` / `--chat-scroll-to-bottom-height` (24px), `--chat-scroll-to-bottom-border-radius` (4px), `--chat-scroll-to-bottom-gap` (12px space above the composer), and `--chat-scroll-to-bottom-edge-inset` (12px, matches the composer's horizontal padding) — with colors declared in the theme files: `--chat-scroll-to-bottom-background-color` (→ `--background-normal`), `--chat-scroll-to-bottom-border-color` (→ `--border-fill-input`), and `--chat-scroll-to-bottom-shadow`. The button is positioned absolutely over the message area (a sibling of the scroll viewport, alongside the fade overlays) so it reserves no layout height at the end of the thread and its end edge lines up with the composer's.
- Top and bottom fade overlays on the chat thread. The message area now fades its content into the panel background at both edges instead of ending in a hard cut, softening where messages meet the header above and the composer below. The overlay color is the theme surface rather than a hardcoded white, so it tracks every theme: a new companion token `--background-normal-rgb` (the RGB channels of `--background-normal`, added to every built-in theme) feeds `rgb(var(--background-normal-rgb) / <alpha>)`, so each gradient's far stop is the *same* color at a reduced alpha. This avoids a fade through grey (only the alpha changes between stops) and uses `rgb()` slash-alpha — far more widely supported than `color-mix()` — instead of the previous `color-mix`. The top fade goes to fully transparent; the bottom fade stops at 60% opacity per the design. Shown by default; the new `hideThreadFade` widget config removes both overlays entirely (mirroring `hideScrollToBottomButton`). Custom themes that want the fade should provide `--background-normal-rgb` alongside `--background-normal` (it's now part of `ThemeTokens`); without it the fade simply doesn't render. The overlays span the same centered, `--thread-padding-x`-inset column as the messages (capped at `--thread-max-width`, painting only over the content box) so they cover message content only, not the gutters. They live in a non-scrolling wrapper around the scroll viewport so they stay pinned to the edges rather than scrolling with the content, and their heights are token-driven on `.aui-root` via `--chat-thread-fade-height-top` (default `8px`) and `--chat-thread-fade-height-bottom` (default `12px`); set either to `0` to remove that edge's fade.
- Settings page layout is now tunable via CSS tokens (declared with their previous values on `.aui-root` in `styles/index.css`, overridable on any `.aui-root` ancestor), so the framing is no longer hardcoded: `--ai-settings-margin-x` / `--ai-settings-margin-y` set the page margins (default `32px`; the existing `noPadding` prop still forces them to 0), and `--ai-settings-max-width` caps the content column (default `640px`, previously a hardcoded `max-w-[640px]`). The settings tabs also accept optional inner padding via `--ai-settings-tabs-list-padding` (inset for the tab row) and `--ai-settings-tabs-content-padding` (inline + bottom inner padding for the scrollable content — raise it to inset the content from the scrollbar), both defaulting to `0`. These are passed only to the settings `Tabs` instance (via new optional `listClassName` / `contentClassName` props on the `Tabs` component), so other tabs in the library are unaffected. All defaults reproduce the previous layout exactly, so nothing changes visually unless a token is overridden.

- `showClearHistory` widget config — shows the "Clear history" item in each chat's context menu (the "…" dropdown in the chat-history list). Hidden by default now; set to `true` to expose it. When hidden, the menu's separator sits before "Delete" so the destructive action stays set apart; when shown, "Delete" keeps its place and the separator moves below it, ahead of "Clear history".
- `onDeletePromptFolder` widget callback — lets the host own the prompt-folder delete confirmation UI (mirrors `onRenamePromptFolder`). Receives `(currentName, folderId)`; return `true` to proceed with deletion, or nothing/`false` to cancel. Falls back to the built-in confirmation dialog when omitted.
- `PlatformEnvironment.onEnvironmentChange` can now report display-density changes: the callback info object gained an optional `devicePixelRatio` field alongside `theme`/`lang`. When a host sends it (e.g. after the window moves to a monitor with a different DPR, or on browser zoom), `<Icon>` re-selects scale-appropriate raster icons at runtime in `iconFormat: "png"` mode — previously the display scale was read only once at startup. The field is fully optional and additive: hosts that never send it keep the startup scale, with no code or type changes required.
- `iconFormat` widget config (`"svg"` | `"png"`, default `"svg"`) — chooses which built-in icon format wins for names that ship as both a vector SVG and a multi-scale raster (PNG) set. `"svg"` keeps the historical behavior (the inlined SVG component is used and raster PNGs only cover names with no SVG). `"png"` gives priority to the scale-appropriate PNG (selected by theme + display scale via `getImageSrc`), falling back to the bundled SVG for icons that have no raster variant. Host overrides supplied via `images` (component or URL) always take priority over both, regardless of this preference. Threaded through `ImagesProvider` (new `iconFormat` prop) into the images context (`ImagesContextValue.iconFormat`); `<Icon>` reorders its bundled-SVG-vs-raster resolution accordingly.
- Log-level control. The library's internal logger now gates output on a module-global severity threshold. New exports `setLogLevel(level)` / `getLogLevel()` and the `LogLevel` type (`"debug" | "info" | "warn" | "error" | "silent"`), plus a `logLevel` widget config prop (applied synchronously on render), let hosts quiet the noisy `info`/`debug` tracing (MCP startup, image generation, …) while keeping warnings and errors — or silence everything. Defaults to `"debug"` (log everything), so existing behavior is unchanged until a host opts in.
- Extended reasoning is now available on the one-shot (`sendMessageSync`) path, not just streaming chat. `SendMessageSyncArgs` gained a `withReasoning?` flag (mirroring `SendMessageArgs`), wired from `actionArgs.isReasoning` through every one-shot action (summarization, translation, OCR, vision, text-analysis, title, custom-prompt, and the image-generation text fallback). The OpenAI, Anthropic, GenAI, and Mistral providers honor it in their sync requests using the same per-provider mapping as the streaming path; other providers ignore it. Defaults to off, so existing one-shot calls are unchanged.
- Composer input now shows an "Ask anything…" placeholder, translated across all locales.
- `chatHistoryCloseIcon` widget config — chooses the icon for the chat-history panel's close button (`"btn-close"` default, or `"btn-arrow-up"`). Lets hosts that embed the widget in a panel with its own close button show a back/collapse arrow instead of a second "×".
- Per-section font-size tokens for the chat-history list: `--chat-list-title-font-size`, `--chat-list-group-header-font-size`, and `--chat-list-item-font-size`. They default to the existing `--fs-*` scale (sizing unchanged), so hosts can resize the history list independently of the rest of the widget via `customTheme` or host CSS.
- Per-section font-weight tokens for the chat-history list: `--chat-list-title-font-weight` (defaults to bold/700), `--chat-list-group-header-font-weight`, and `--chat-list-item-font-weight` (default to normal/400). Settable via `customTheme` or host CSS, with sizing/weight unchanged by default.
- Chat-history header can be hidden — the "Chat history" title and its close button, keeping the search field and thread list. Via the `hideChatHistoryHeader` widget config (for `<AIChatWidget>` hosts that provide their own title bar/close control), or the new `hideHeader` prop on the exported `ChatList` component (for headless usage); the prop overrides the config when both are set.
- `className` prop on the exported `ChatList` component, merged onto its root container with `tailwind-merge` (so passed utilities override the built-in ones) for external styling in headless usage.
- Chat-history thread actions trigger ("⋯") can be shown permanently instead of only on hover. Via the `chatHistoryAlwaysShowActions` widget config (for `<AIChatWidget>` hosts, e.g. touch devices), the `alwaysShowActions` prop on the exported `ChatList`, or the same prop on `ChatListItem`; the props override the config when set.
- `--combo-box-height` theme token controls the combo-box height (defaults to `24px`, sizing unchanged), so hosts can resize combo-boxes via `customTheme` or host CSS independently of the rest of the widget.
- `--combo-box-padding-start` and `--combo-box-padding-end` theme tokens control the `ComboBox` trigger's horizontal padding (defaults `4px` / `0px`, matching the previous hard-coded values). Padding is logical (`ps`/`pe`), so it mirrors in RTL; set via `customTheme` or host CSS. Defaults reproduce the previous layout, so nothing changes visually unless overridden.
- `--input-height` theme token controls the `Input` component's height (defaults to `24px`, sizing unchanged), so hosts can resize text inputs via `customTheme` or host CSS independently of the rest of the widget.
- `--input-padding-start` and `--input-padding-end` theme tokens control the `Input` component's horizontal padding (defaults `4px` / `2px`, matching the previous hard-coded values). Padding is logical (`ps`/`pe`), so it mirrors in RTL; set via `customTheme` or host CSS. Defaults reproduce the previous layout, so nothing changes visually unless overridden.
- `--dropdown-trigger-color` and `--dropdown-trigger-hover-color` theme tokens set the dropdown trigger's text color in its resting and hover states; the trigger's icon follows via `fill-current`. Neither is shipped in the bundled themes — they fall back to `--icon-button-color` (rest) and `--text-normal` (hover), so the trigger keeps its default coloring unless a host sets the tokens via `customTheme` or host CSS.
- Per-button color tokens for the composer action triggers, each with a built-in fallback so default coloring is unchanged: `--attachment-button-color` / `--attachment-button-hover-color` (the "+" attachments trigger) and `--prompt-button-color` / `--prompt-button-hover-color` (the saved-prompts trigger). Both fall back to `--icon-button-color` (rest) and `--text-normal` (hover); the icon follows the text color via `fill-current`. Lets hosts tint these buttons and their hover state via `customTheme` or host CSS.
- `composerActionSendSize` widget config — the pixel size of the composer's send / stop action button (the icon and its square button box). Defaults to `17`, for hosts that need a larger or smaller send control to match a custom composer height.
- `composerPlaceholder` widget config — overrides the composer input's built-in localized "Ask anything…" placeholder with a host-supplied string (not translated). Omit to keep the built-in string.
- `addLocalImageEnabled` widget config — shows the built-in "Add local image" item in the composer's "+" (attachments) dropdown. Opt-in: the item appears only when this is `true` (see the matching note under Changed).
- Composer layout theme tokens, each with a built-in fallback so sizing is unchanged by default: `--chat-input-min-height` (the input textarea's min-height, `20px`), `--chat-input-actions-height` (the composer action-bar row height, `20px`), and `--action-gap` (the gap between the left-side composer action buttons, `4px`). Settable via `customTheme` or host CSS.
- `--chat-input-font-size` and `--chat-input-font-weight` theme tokens for the composer input's text. Both fall back to `inherit`, so by default the input keeps following the widget's font scale; hosts can override either via `customTheme` or host CSS.
- `--message-actions-gap` theme token controls the spacing between the action buttons under an assistant message (Copy / regenerate / Save and any host `assistantActions`). Defaults to `2px` (spacing unchanged); settable via `customTheme` or host CSS.
- `icon-button` CSS class on every `IconButton` root element, giving hosts a stable selector to target icon buttons from host CSS.
- `dropdownNavigation` widget config — chooses how nested submenus are presented in dropdown menus. `"flyout"` (default) keeps the historical side flyouts; `"drilldown"` replaces the current menu level in place with the child level and shows a "back" row to return, so nested menus stay within the menu's bounds (better for narrow/embedded hosts such as iframes, mobile, and side panels). Can be overridden per menu via the new `DropdownMenu` `navigation` prop. Both modes reuse the same `DropDownItem` rendering, so icons, padding/`withSpace` alignment, `tooltipText`, `withAbout`, toggles, and the reveal-on-hover "more" icon behave identically; only submenu navigation differs. Drill-down navigation re-resolves the visible level against the live items tree each render, so an external rebuild (e.g. flipping a tool toggle inside a submenu) keeps the user at the same depth instead of resetting to the root.
- `PlatformAdapter.copyToClipboard` now receives an optional second argument `meta: { format: "markdown" | "text" }` describing what is being copied. Message bodies (assistant replies and user prompts) pass `format: "markdown"`; raw content (code blocks, tool args/results) passes `format: "text"`. The parameter is additive and backward compatible; ignoring it keeps the previous behavior. Added exported types `CopyFormat` and `CopyMeta`.
- The `"external"` provider now supports `Profile.basedOn` values `"anthropic"`, `"mistral"`, and `"openrouter"` in addition to `"openai"`. Each delegates to the matching inner provider, so a profile with `providerType: "external"` reuses that provider's request builder and response parser while the host owns transport via `PlatformAdapter.externalFetch`. The remaining values (`"genai"`, `"stabilityai"`, …) stay reserved and throw at request time.
- `disableBuiltinImageTool` widget config (and matching `AIEngine` dep) — opts the built-in `generate_image` chat tool out of the tool list. Lets a host that ships its own image-generation tool avoid offering the model two same-purpose tools. Default false. Gates only the chat tool: the one-shot image-generation action (and its `ImageGeneration` assignment) keep working. When set, the engine skips the tool — and the assignment read behind it — entirely.
- Host-defined chat export formats. The new optional `PlatformFileOperations.getExportFormats()` lets a host declare a list of export formats (`ExportFormat = { id, label, extension }`, also exported). When more than one format is returned, the chat-list "Save" item becomes an "Export to…" submenu listing every format; choosing one calls `saveAsFile(content, "<name>.<extension>", formatId)` with the new optional third `format` argument (the chosen `ExportFormat.id`). The library always passes Markdown source as `content`, so the host converts it to the target format. When no formats are declared (or only one), the single default "Save" action is kept and `saveAsFile` is called with two arguments as before — fully backward compatible. Also added `AIChatWidgetRef.exportThread(threadId, formatId)` and the `onExportThread` thread-store action.

### Changed

- Combo-boxes no longer hard-code their height at the call sites (model config form, model assignment, web search, and the composer model selector); they now follow the `--combo-box-height` theme token instead. Default height is unchanged.
- Text inputs no longer hard-code their height at the call sites (model config form's key / URL / name fields and web search's URL / key fields); they now follow the `--input-height` theme token instead. Default height is unchanged.
- `IconButton` now sets an explicit `bg-transparent` (transparent `background-color`) in its base styles, so it no longer inherits a surface background by default; hover / active / active-state backgrounds still apply on top.
- `IconButton` now recolors its icon from the button's own text color (`currentColor`), so `text-*` and hover utilities passed via `className` recolor the icon (both its filled and stroked parts). The fill/stroke split is detected purely in CSS from the SVG's authored paint: filled paths take `fill: currentColor`, while paths carrying a `stroke` attribute are treated as outlines (`fill: none`, `stroke: currentColor`). The base text color defaults to `--icon-button-color`, so default appearance is unchanged. Skipped when the caller pins an explicit `color` (e.g. the composer send/stop button, which keeps `--chat-composer-action-send-color`) or opts out with `noColor` (self-colored icons). This is what makes the new `--dropdown-trigger-*`, `--attachment-button-*`, and `--prompt-button-*` hover tints drive the icon.
- Reworked the `Input` component's layout from absolute-positioned overlays to flexbox: the bordered box (border / background / hover / focus state, now `focus-within`) moved to the wrapper, the input fills the remaining space as a transparent flex child, and the trailing icon / clear button are laid out as flex siblings instead of being absolutely positioned over the input's padding. The error border now sits on the wrapper rather than the inner `<input>`.
- Redesigned the off (unchecked) state of toggle buttons. The track no longer fills with a solid gray; instead it shows a `--background-normal` fill with a visible border, and the thumb is tinted to match the border. New `--chb-border-normal` theme token (`#7f7f7f` in light themes, `#949494` in dark themes) drives both the off-state border and thumb via the new `--toggle-button-off-border-color` / `--toggle-button-off-circle-color` tokens; `--toggle-button-off-background-color` now resolves to `--background-normal`. The on (checked) state and the default 30×18 track / 12×12 thumb sizing are unchanged. The thumb sits 3px from the track's outer edge on both ends. Toggle geometry is now driven by structural tokens on `.aui-root` (`--toggle-button-track-width`, `--toggle-button-track-height`, `--toggle-button-thumb-size`, `--toggle-button-thumb-offset`, `--toggle-button-thumb-offset-checked`) so hosts can resize/reposition the track and thumb without overriding component classes.
- Message action bar icons (`btn-copy`, `btn-reset`, and the new `btn-save.small`) replaced with new 20 px stroke-based designs; icon size reduced from 24 px to 20 px for a denser interface. Action bar icons now render in a new `--icon-gray-secondary` theme token (`#949494` in light themes, `#B2B2B2` in dark themes) instead of the primary icon color. The `btn-save` icon is now split into two sizes: the message action bar's "Save" button uses the new smaller `btn-save.small`, while the chat-list item's download button keeps the full-size `btn-save` (redrawn to match).
- The user-message action bar's "more" (⋯) dropdown trigger now uses a new smaller `btn-more.small` icon. Everywhere else the icon is used (chat-list item, model card, MCP tools, dropdown submenus) keeps the full-size `more` icon.
- The model-assignment "Code" field now uses a new smaller `code.small` icon. Everywhere else the icon is used (e.g. code tool-call cards) keeps the full-size `code` icon.
- Redesigned the initial-setup page: tighter page margins (32 px → 12 px) and a smaller, left-aligned heading on the "Connect AI Model" card (20 px bold centered → 13 px bold).
- Text selection disabled across settings pages (initial-setup, MCP servers, model assignment, web search) and tab labels; the MCP config editor retains `select-text` so JSON configs can still be copied.
- Redesigned the composer. The model picker moved from the top "Ask <model>" row into the bottom action bar, next to the send button; new send and stop icons (light/dark variants); the saved-prompts button now uses a stroke icon; the composer corners are squared off (16px → 4px radius); and the input no longer hard-codes `font-size`/`line-height`, so it follows the configurable font sizing.
- **Behavior change:** the composer's built-in "Add local image" attachment item is now opt-in. It previously appeared unconditionally; it now shows only when the new `addLocalImageEnabled` widget config is `true`. Hosts that relied on it must set `addLocalImageEnabled: true`.
- Redesigned the chat-history panel: tighter, denser spacing (24px gutters → 8/12px, smaller header and group-header margins), restyled date-group headers, and a new search icon (a cleaner single-stroke magnifying glass). The search field's icon now sits at the trailing (end) edge of the input instead of the leading edge, and hides while the clear ("×") button is shown.
- The active conversation's accent marker is now theme-driven. New `--border-toolbar` token (reused by `--chat-list-item-active-marker-bg`) replaces the hard-coded `#585858` bar — `#cbcbcb` in light themes, `#585858` in dark.
- White and night themes: hover/pressed backgrounds (`--highlight-button-hover` / `--highlight-button-pressed`) now use translucent (alpha) colors so they layer correctly over any surface, replacing the previous opaque values.
- Tightened vertical spacing throughout chat messages. Markdown blocks (headings, paragraphs, lists, rules, tables) now use a uniform 8px vertical margin instead of the previous 16–32px; the gap between messages dropped from 24px to 10px and per-message padding from 16px to 8px; and tool-call cards are more compact. List indents switched to logical (`ms-*`) so they mirror correctly in RTL. The "Tool executed" label shown while a tool runs was removed.
- Redesigned the input, combo-box, and dropdown components for a denser, flatter look. Inputs and combo-boxes are shorter (24px) with tighter padding; the combo-box uses a new minimal chevron icon (`arrow`); input search/clear icons are larger (24px); and dropdown menus have a smaller corner radius (8px → 4px) with tighter rows (28px → 26px). Component icons are now tinted with `--icon-normal`.
- Retuned the white and night themes: flatter text/icon colors, a simplified input background and hover state, and a dedicated blue `--input-active-border-color`. The composer's active border now reuses it (`--chat-composer-active-border-color` → `--input-active-border-color`) across all themes.
- Replaced the `ask-ai`, `summarization`, `translation`, `text-analysis-ai`, `image-generation`, `ocr`, and `vision-ai` icons (light, dark, and SVG variants) with new designs.
- Replaced the `btn-menu-about` (info) icon with a new filled design (light, dark, and SVG variants). It now renders self-colored (`noColor`) instead of being theme-recolored, since it carries its own grey/white knockout that reads on both light and dark themes.
- Replaced the `more` (⋯) icon with a new 24 px design (light, dark, and SVG variants), and bumped its render size from 20 px to 24 px everywhere it is used (chat-list item, model card, MCP tools, and dropdown submenus).
- Replaced the `btn-prompt` (saved-prompts) icon with a new design (light, dark, and SVG variants).
- The composer's Attachments dropdown trigger now uses a new `btn-attach.small` icon (light, dark, and SVG variants) in place of `btn-zoomup`.
- `Icon` now recolors each SVG shape by the paint method it already declares — shapes with an explicit `stroke` get their stroke recolored, those with a `fill` get their fill recolored, and those with both get both. This makes mixed fill/stroke icons (such as the new `summarization` icon) theme correctly, and also covers `rect`/`line`/`polygon`/`polyline`/`ellipse` in addition to `path`/`circle`. The `isStroke` prop is now only a fallback for shapes that declare neither.
- Host-supplied custom icon components (registered via `getIconComponent`) are now wrapped in the same ref'd span as bundled icons and run through the same `applySvgColor` pass, so they theme via `color` / `noColor` / `isStroke` identically instead of rendering un-recolored. The wrapper's `className` now sits on the span (matching the bundled-icon path) rather than being forwarded to the custom component.
- `FieldContainer` accepts an `iconIsStroke` prop, forwarded to its header `Icon` as `isStroke`.
- Added a `--background-card-normal` base color token to every theme (`#FFFFFF` in light themes, `#505050` in dark themes). The model card now derives its background from it (`--model-card-background-color` → `var(--background-card-normal)`).
- Added a `--background-icon-normal` base color token to every theme (`#FFFFFF` in light themes, `#404040` in dark themes).
- Dropdown menu items now use layout-aware horizontal padding driven by overridable CSS tokens, distinct from combo-box items. `DropdownMenu` gained a `variant` prop (`"menu"` default, `"combobox"`) propagated to every item; `ComboBox` sets `"combobox"` to keep its symmetric, trigger-matching padding. A menu row is a "text" row (no leading icon) or an "icon" row (leading icon, or space reserved via `withSpace`): icon rows indent the start edge, and the end edge tightens to the "control" value when the row ends in an interactive control (trailing icon, toggle, submenu chevron, about button). All values are settable on `.aui-root`, with each token named for the row type it applies to: `--dropdown-item-padding-start-text` (16px) / `--dropdown-item-padding-end-text` (16px), `--dropdown-item-padding-start-icon` (4px) / `--dropdown-item-padding-end-icon` (20px), `--dropdown-item-padding-end-control` (8px), and `--dropdown-item-padding-start-combobox` / `--dropdown-item-padding-end-combobox` (8px). Padding is logical (`ps`/`pe`), so it mirrors correctly in RTL. In mixed menus where some rows have a leading icon and some don't, the icon-less rows reserve the icon column automatically so all labels line up (each submenu is evaluated independently); a per-item `withSpace` still works as an explicit override.
- A dropdown row's "more" trigger (`subMenuIcon`, e.g. the per-prompt context menu on saved-prompt rows) is now hidden until the row is hovered or focused, and stays visible while its menu is open. It uses opacity so the row layout doesn't shift. The plain submenu chevron (rows without `subMenuIcon`) remains always visible.
- Control borders now flow through a new `--border-fill-input` theme token (an alias of `--border-regular-control`) instead of referencing `--border-regular-control` directly: `--input-border-color`, `--button-default-disabled-border-color`, and the night/white `--input-hover-border-color` now read it. The chat composer border (`--chat-composer-border-color`) also switched from `--border-divider` to `--border-fill-input`, so the composer's resting border is slightly more pronounced. The classic-light `--border-regular-control` value was corrected to `#cfcfcf` to match the editor palette; the other themes already matched.

### Fixed

- Approving a tool call no longer dismisses the confirmation dialog of a *different* pending tool call. When the host wires `onToolCallApproveResult` and the model requests a second approval-gated tool in the same continuation stream, the tail safety-net `closeDialog()` in `approveToolCall` cleared `manageToolData` unconditionally — wiping the second tool's just-shown dialog while the stream was already paused waiting for it, leaving that tool stuck forever. The dialog is now cleared only if it still belongs to the call being approved (matching `messageId` + `idx`), in the tail safety net, the tool-result watch callback, and the middleware `skip` branch alike.
- Tooltips (e.g. on the composer's icon buttons) no longer stay stuck open after the cursor leaves the chat iframe quickly. Radix closes a hover-opened tooltip only when the trigger element receives a `pointerleave` event, but when the pointer crosses the iframe boundary fast that event never reaches the trigger, so the tooltip lingered. The `Tooltip` wrapper now tracks its own open state (only for uncontrolled tooltips — the controlled `open={…}` usages are untouched) and force-closes on `document.documentElement`'s `mouseleave` and the frame's `blur`, both of which fire when the pointer exits the iframe. Listeners are attached only while a tooltip is open and torn down on close.
- The chat thread now scrolls to the bottom when the user sends a message, even if they had scrolled up to read earlier messages. Previously it only followed the reply if the viewport was already at the bottom. Root cause: the thread is driven by `useExternalStoreRuntime` without an `isRunning` flag, so the runtime never emitted `thread.run-start` and assistant-ui's built-in "scroll to bottom on run start" stayed inert — leaving only the resize-based autoscroll, which is gated on `isAtBottom`. The runtime is now fed `isRunning` (the store's `isStreamRunning`, which spans the whole round), so `thread.run-start` fires and the native scroll-on-send works. Feeding `isRunning` also makes the runtime emit an optimistic empty-assistant placeholder for the in-flight turn; the assistant message renderer now skips empty `running` (and cancelled empty `incomplete`) messages so that placeholder doesn't show an empty bubble next to the "Analyzing" indicator.
- The MCP config editor no longer mirrors the JSON in RTL locales. The editor container carries the UI direction (so its header, labels, and footer read RTL), which also flipped the CodeMirror editor — right-aligning the code and moving the line-number gutter to the right, making the config unreadable. The CodeMirror host now forces `dir="ltr"` (a JSON config is always left-to-right) while the surrounding chrome keeps following the UI direction.
- Tooltip content is no longer stuck in left-to-right in RTL locales. Radix resolves direction from its own `DirectionProvider` context (not the DOM) and, with none present, defaulted to `"ltr"` and stamped `dir="ltr"` on the portaled tooltip — which renders outside the widget's RTL root, so it never inherited the UI direction. `TooltipContent` now passes the ambient direction (`dir={direction}` from `useI18n()`) explicitly, matching the approach already used for dropdown menus.
- Truncated combo-box values and dropdown-menu item labels no longer clip the beginning of left-to-right text in RTL locales. The `truncate` ellipsis follows the writing direction, so in an RTL context an LTR string (e.g. a model ID like `OpenRouter - openai/gpt-5.2`) had its head cut off on the left (`…outer - google/…`). The value span in `ComboBox` and the label span in `DropDownItem` now carry `dir="auto"`, resolving direction from the content so the ellipsis lands at the string's own end — LTR values truncate on the right, RTL labels on the left. The `ComboBox` value span also drops `flex-1` so it hugs its content and the trigger's `justify-between` parks it at the reading start (right in RTL, left in LTR), aligning short LTR values with the rest of the RTL UI instead of pinning them to the left; long values still shrink and truncate via `min-w-0`. The `ModelCard` name and provider lines get the same treatment: `dir="auto"` for tail truncation, and each line is wrapped in its own flex row so `justify-content: flex-start` (which follows the ambient direction, like the ComboBox trigger) parks a short LTR label at the reading start (right in RTL) instead of the left, while long labels shrink and truncate via `min-w-0`.
- The MCP "Available tools" server rows now show the correct expand/collapse chevron in RTL locales. When a group was expanded, the chevron was rotated 180° (pointing up) instead of down — vertical direction shouldn't mirror in RTL. It now points down when expanded (matching LTR) and only the collapsed state flips (right in LTR, left in RTL), consistent with the other collapsible chevrons in the library.
- The `Tabs` component now forwards the active text direction to its Radix `Tabs.Root` (`dir={direction}` from `useI18n()`). Radix resolves direction from its own `DirectionProvider` context — not the DOM `dir` attribute — and defaults to `"ltr"` when neither a `dir` prop nor a `DirectionProvider` is present, stamping `dir="ltr"` onto the root element and overriding any inherited RTL direction for the tabs subtree. This was visible in RTL locales (`ar-SA`), and especially in headless setups that render pages without the built-in `Layout` (which is the only place the widget sets a root `dir`). Other Radix-based components (dropdowns, dialogs) already passed `dir` explicitly; tabs were the sole omission. The now-redundant `flex-row-reverse` manual mirror on the tab list was removed — with `dir="rtl"` propagating, the default `flex-direction: row` already lays the triggers out right-to-left, so the extra reverse would have double-flipped them back to LTR order. The tab triggers' physical corner-rounding and border-collapse utilities (`rounded-l`/`rounded-r`, `-ml-px`/`first:ml-0`) were also switched to their logical equivalents (`rounded-s`/`rounded-e`, `-ms-px`/`first:ms-0`) so the rounded outer corners and the seamless collapsed edge follow the writing direction instead of staying pinned to the physical left in RTL.
- The theme store now seeds `themeId`/`themeType`/`scale` synchronously from the platform (`ctx.platform.env`) at creation, instead of starting on a hardcoded `"theme-light"` default — a class that isn't bundled in `themes.css` (only `.theme-white` and `.theme-night` are imported). Previously the first painted frame carried the unbundled `theme-light` class (no theme variables resolved) and `ThemeProvider`'s `initFromPlatform()` swapped in the real theme on a second commit, which animated themed components with `transition-colors` — a visible flicker on mount (e.g. when opening settings in `theme-night`). Seeding at creation makes the first frame carry the host theme, so there is no second re-painting commit and no start-up flicker, while runtime theme switching, hover, and density changes keep animating normally. When the host provides no theme at all (empty/unset `env.theme`), the seed falls back to the bundled `"theme-white"`; a non-empty custom theme name is passed through untouched. `initFromPlatform()` is retained (now a no-op after the eager seed) so existing callers are unaffected.
- In `iconFormat: "png"` mode, icons no longer render a soft, upscaled bitmap on displays whose scale exceeds the densest bundled raster. The built-in PNGs top out at `@2x`, so above 2x `<Icon>` now falls back to the crisp bundled SVG for names that ship one (host overrides and raster-only names are unaffected — the raster is still used as the best available). `getImageSrc` now reports the matched raster's `scale` so callers can make this decision.
- Renamed the `btn-extended-thinking` high-DPI rasters (`@1.25x`/`@1.5x`/`@1.75x`/`@2x`) whose filenames were missing the trailing `x` in the scale suffix. Without it they failed the image-name parser and were silently dropped, so the icon only ever loaded its 1x variant; they now register and serve at the correct scales.
- A `DropDownItem` whose element `icon` renders to `null` no longer collapses its label to the left: the leading icon now sits in a `display: contents` `.dd-leading` slot, and for element icons a `.dd-leading:empty + &` variant reserves the icon column on the label (28px, matching `withSpace`) when the slot is empty, keeping it aligned with sibling icon rows. String icons, `withSpace`, and plain text rows are unaffected.
- Added the missing dark-theme `btn-extended-thinking` rasters (base + `@1.25x`/`@1.5x`/`@1.75x`/`@2x`). It previously shipped only in the light set, so in `iconFormat: "png"` dark mode it fell back to the recolored bundled SVG instead of a matching raster. The light and dark PNG icon sets are now at parity.
- Adding a model for locally-hosted providers (Ollama, LM Studio, GPT4All) no longer requires filling in the API Key field. These providers run an unauthenticated OpenAI-compatible server, so the "Add Model" button is now enabled with an empty key. The core already substitutes a dummy key, so such profiles work without one. A failed model fetch for these providers (server not running or CORS not configured) now surfaces the underlying error instead of failing silently with an empty model list.
- Chat-history search no longer shows the empty-history message ("There is no chat history yet…") when a search simply matches nothing. The no-results state now uses a distinct `NoChatsFound` string ("No chats found"), translated across all locales, leaving "There is no chat history yet…" for when there are genuinely no threads.
- The continuation request that follows a tool call now keeps the system-prompt override and the tool list, instead of silently rebuilding the round without them. Two independent regressions on the resume path caused this: (1) the `prompt` override passed in `actionArgs` was dropped by the engine's resume path — `resumeChat`, `resumeAndContinue`, and the adapter auto-execution context (`AdapterRunContext` / `executeAdapterTool`) never carried it over — so `chat()` fell back to the built-in default system prompt on every tool-call continuation; and (2) the six UI resume sites (approve / deny, including the middleware and auto-allow paths) read the tool list from a stale render-time snapshot captured when the driving `processStream` invocation started, rather than from the live store. Because a running async generator keeps its start-of-turn closure, tools that finished loading (e.g. MCP discovery) after the turn began were absent from that snapshot, so the continuation went out with no tools — intermittently, depending on load timing. Symptoms: the assistant claimed it performed an action it never invoked, or printed the tool call as plain text; citations dropped on any reply after a tool call; multi-step tool tasks (read, then write) failed to complete in one turn. Fixed by threading `prompt` through the whole resume path and having the resume sites read tools fresh via `useServersStore.getState().tools`, matching what the send path already did.
- Dropdown menus no longer spill off the edge of the screen in narrow or embedded hosts (iframes, side panels). Radix collision avoidance is re-enabled (it had been disabled), so menus flip and shift to stay within the viewport, and the content is capped to the available width/height (`--radix-dropdown-menu-content-available-*`) so a menu wider or taller than the space shrinks and scrolls instead of overflowing. The previous manual `side`/`align` heuristic is kept only as a preferred-direction hint. Affects every dropdown, including the composer "+" and saved-prompts menus.
- Composer no longer submits a new message via Enter while a response is still streaming.
- "Open" item in the chat-list context menu now closes the menu before navigating to the conversation.
- Spinner loader no longer shrinks when placed inside a flex container (`shrink-0` added).
- MCP server config editor (CodeMirror) now has a minimum height of 215 px so the editor and its gutter don't collapse on short configs.
- Per-element font sizing now actually applies. The `--fs-*` type-scale tokens were used as `text-[var(--fs-*)]`, which Tailwind compiles to `color` (not `font-size`) — so element sizes never took effect and, on elements that also set a text color, the invalid `color` value clobbered it. Added `text-fs-*` utilities that set `font-size` explicitly and switched all usages to them.
- `text-fs-*` utilities no longer get stripped by `cn()`. tailwind-merge treated these custom utilities as text-color classes and dropped them whenever a `text-[...]` color class shared the same `cn()` call (e.g. the model-card provider name lost its `text-fs-10`). Registered them in tailwind-merge's `font-size` group so size and color no longer conflict.
- The built-in `generate_image` tool now resolves the host fetch for its own image-generation profile, so it works for profiles with `providerType: "external"` (and for any provider opting into `fetchProxy` via `useProxy`/`forceProxy`). Previously the tool built its provider without a fetch and fell back to the global `fetch` — an `external` profile then had no transport and image generation failed mid-chat, even though the one-shot image-generation action worked. The engine's `pickFetch` is now carried on the adapter-run context across every chat path that auto-executes a built-in tool (streaming send, regenerate, and the resume after a tool approval) and threaded through `executeAdapterTool` into the tool, which runs its OWN resolved profile (distinct from the chat profile that issued the call) through it. A misconfigured `external` image profile now surfaces as a tool-result error instead of throwing into the chat stream.
- The web-search "Get API key" link now pins its color to the `--link-secondary-color` token with `!important`, matching the model config form. Without it, host stylesheets could override the link color, so the same link rendered in a different color in web search than in the model config form.
- MCP servers with an error (a stopped server that exposes no tools) no longer show a "more" context-menu button with an empty menu. The button is now hidden whenever there are no menu items to show.
- A server-mode backend streaming a non-contract `{ type: "error", message }` envelope (e.g. on a failed resume/approve) no longer crashes the chat with "Unknown message role: undefined". Such an envelope isn't part of the `ChatEvent` union, so it previously fell through to the message-chunk path and its `message` string was pushed into the store as a message. It's now recognized explicitly and surfaced on the in-flight assistant turn with the same `incomplete` / `reason: "error"` status a real `message-incomplete` event carries, so the UI renders its error block (instead of leaving a tool call spinning) and emits `onStreamError`.

## 0.4.146

### Added

- Optional `headers` field on the web-search config (`WebSearchConfig`) — extra HTTP headers (e.g. `X-Tenant`) forwarded with every request to the ONLYOFFICE / cloud backend, for both the live tool calls (`web_search`, `web_crawling`) and the connection test. Headers are merged after the derived `Authorization: Bearer <key>` header, so a custom header of the same name wins.

### Changed

- The ONLYOFFICE / cloud web-search backend is now called at `<baseUrl>/search` and `<baseUrl>/contents` (was `/api/2.0/ai/web-search/v1/*`), with an `engine: "exa"` field in the request body. Crawling now forwards the full `urls` array instead of only the first URL.

## 0.4.145

### Added

- `onRenamePromptFolder` widget callback — lets the host own the prompt-folder rename UI (mirrors `onCreatePromptFolder`). Receives `(currentName, folderId)`; return a non-empty string to rename, or nothing to cancel. Falls back to the built-in dialog when omitted.

## 0.4.144

### Fixed

- Removed a stray left indent on assistant (agent) messages. A leftover `ml-4`/`ml-3` from the avatar-column template offset agent replies and their action bar; both now align flush with the thread padding edge, matching user messages.

## 0.4.143

### Fixed

- Attaching an empty (0-byte) file no longer crashes the chat. The Anthropic provider rejected the resulting payload-less `data:` URL; it now degrades such blocks to inert text (matching the GenAI provider), and 0-byte files are filtered out at the composer image picker and drag-and-drop entry points.

## 0.4.142

### Added

- LaTeX math rendering in chat messages via KaTeX (`remark-math` + `rehype-katex`). Inline `$...$` and block `$$...$$` formulas now render. `katex`, `remark-math`, and `rehype-katex` are optional peer dependencies — install them to enable math; the widget imports `katex/dist/katex.min.css` so the consumer's bundler resolves the KaTeX styles and fonts.

### Changed

- `PlatformAdapter.file` is now optional and accepts a partial implementation (`file?: Partial<PlatformFileOperations>`). Hosts may omit it or provide only a subset of file operations; unavailable operations hide their UI. Previously required `file: PlatformFileOperations | null`.

## 0.4.141

### Changed

- The `onlyoffice` provider is now a thin OpenAI-compatible provider (no custom URL transform, SSE transport, or REST model endpoint). It is registered so host-supplied profiles resolve and run from storage, but stays hidden from the manual add-profile dropdown — users cannot create one by hand.

## 0.4.140

### Fixed

- A tool result resolved after the user stopped the stream (e.g. a host-supplied `{ cancelled: true }`) is now persisted to storage, not just shown in the UI. The auto-execute path returned early on stop before `resumeChat` mirrored the result, so the tool-call stayed result-less and showed as "running" when the thread was reopened. The result is now written directly via `updateMessage` on that path.

## 0.4.139

### Changed

- `onCreatePrompt` / `onEditPrompt` now also receive `folders` (`{ id, name }[]`, all existing prompt folders) so the host can render a folder picker, and may return a `folderId: string | null` to choose where to save (`null` = root). Omitting `folderId` keeps the previous behavior (create: the triggering folder; edit: the prompt's current folder). New exported types: `PromptFolderInfo`, `PromptResult`.

## 0.4.138

### Added

- `suggestions` widget config — clickable prompt chips shown above the composer in a new (empty) chat. Each item is `{ name, prompt }`; clicking inserts its `prompt` into the composer. Capped at 20. Chips wrap into rows, cap at the parent width, and truncate the label with an ellipsis when it overflows.
- `suggestionsHeader` widget config — arbitrary content rendered at the very top of a new (empty) chat, shown only when `suggestions` are visible.

  ```tsx
  <AIChatWidget
    suggestions={[
      { name: "Summarize", prompt: "Summarize this document" },
      { name: "Translate", prompt: "Translate to English" },
    ]}
  />
  ```

## 0.4.137

### Fixed

- Sending a message and immediately pressing "stop" no longer surfaces a spurious `Stream ended unexpectedly without response` error. When the abort closes the OpenAI stream iterator without throwing and before any content arrived, the empty end is now reported as a cancellation (status `cancelled`) instead of an error — Chat Completions and Responses paths (and the ONLYOFFICE proxy). Combined with the empty-cancelled-bubble fix, the stopped turn just disappears.
- Approving a tool no longer stops the chat. The stream-running guard added in 0.4.136 also blocked the manual approve/deny resume — by then the first stream has ended, so it always tripped, the tool result was never persisted, and later requests failed with `No tool output found for function call`. The guard is now scoped to the inline auto-execute path only.
- Stopping the stream while a tool was executing no longer breaks all subsequent requests with `No tool output found for function call`. Request history now strips assistant `tool-call` parts that never got a result before hitting the provider (so the unpaired `function_call` is never sent). Applies to new sends, regenerate, and resume, and repairs already-corrupted threads.
- `reasoning_effort: "none"` is no longer sent to "pro" models (e.g. gpt-5.5-pro), which don't allow any effort below `"medium"`; the field is omitted for them when extended thinking is off.

### Changed

- All 40 non-English locales now carry the full translation key set (previously partial, falling back to English at runtime); unused keys were also removed across every locale and the English audit dropped 26 dead keys.

## 0.4.136

### Added

- `onCreatePrompt` / `onEditPrompt` widget config callbacks let the host own prompt creation and editing in its own window, mirroring `onCreatePromptFolder`. When set, the built-in "Save prompt" auto-name path and the "Edit prompt" dialog are replaced — the host resolves a `{ name, text }` `PromptDraft` and the widget performs the actual `addPrompt`/`editPrompt`. When omitted, the built-in behavior is unchanged.

### Fixed

- Web search now routes through the host `fetchProxy` on every path, including auto-allowed execution in the first chat turn. `webSearchFetch` was only wired into the approve/resume run contexts (introduced in 0.4.135), so an auto-allowed `web_search` ran inline in the initial stream with no proxy and hit the global `fetch` (CORS failure). All four run contexts now carry the proxy.
- The composer web-search toggle now reliably turns web search off. Toggling flipped its two tools (`web_search`, `web_crawling`) with parallel `changeToolStatus` calls that raced — both read the same pre-update disabled list, so only the last write survived and one tool stayed enabled. `changeToolStatus` now accepts an array of names and writes them in one atomic persist; the toggle passes both at once.
- Pressing "stop" while a client-side tool (host / MCP) is executing now actually stops the turn. Previously the tool was cancelled but the chat still ran a resume round and the model kept answering ("I'll do it without a file, just as text: …"). The resume after a client-side tool is gated on the stream still running, and the abort signal is now threaded into the resume request so a stop mid-resume also short-circuits. Engine-side tools already behaved correctly.
- Extended thinking OFF now actually disables reasoning for OpenAI gpt-5.1+ models: the request sends `reasoning_effort: "none"` instead of omitting the field, so the model's default (medium for the 5.5 family) no longer kicks in. Applies to the Chat Completions and Responses paths and the ONLYOFFICE proxy. Models that don't support `"none"` (gpt-5.0, o-series) and non-reasoning models are unchanged. ON still sends `"medium"`. Anthropic already disables thinking when off.
- Sending a message and immediately pressing "stop" no longer leaves an empty assistant bubble with action buttons. A user-cancelled turn (`incomplete`, `reason !== "error"`) with no streamed content is no longer rendered; error turns and cancellations that already have partial text still render as before.

### Changed

- Parallel tool calls are now disabled across all providers that support it, so the model calls at most one tool per turn. OpenAI (Chat Completions + Responses API) and the OpenAI-compatible family (DeepSeek, xAI, OpenRouter, Groq, Together, Ollama, LM Studio, GPT4All, Zhipu, openai-compatible) send `parallel_tool_calls: false`; Mistral sends `parallelToolCalls: false`; the ONLYOFFICE proxy adds `parallel_tool_calls: false` to the body. The flag is only sent when tools are present. Anthropic already disabled it (`disable_parallel_tool_use`). Gemini is unchanged — its API exposes no such flag.
- `PlatformFileOperations` methods are now all optional, and each file-related UI element is gated on its specific capability instead of the whole `file` object. A host can expose only what it supports — e.g. pass `file: { saveAsFile }` to keep chat save/export while hiding the local-file and recent-files pickers. "Add local image" no longer depends on `file` (it uses the HTML input + drag-and-drop). The message "Save" button now renders only when `saveAsFile` is present (also fixes a previously dead button), and `openFile` / thread export are called optionally.

## 0.4.135

### Changed

- Built-in web search now routes its HTTP through the host's `PlatformAdapter.fetchProxy` when one is configured (test-connection, `web_search`, `web_crawling`). Falls back to the global `fetch` when no proxy is set. Unlike provider requests, it is not gated by `Profile.useProxy` — the proxy is used whenever present. HTTP MCP tools already used the proxy.

## 0.4.134

### Fixed

- Tool-generated images no longer bloat the context. The base64 → attachment-ref swap was moved into `resumeChat`, the single point every tool-result path funnels through (engine auto-exec, UI approve, deny) — previously the UI approve path bypassed it and re-sent the full base64 to the model every turn. Detection is now by result shape (`{ data: { base64 } }`) instead of an exact `generate_image` name, so host- and MCP-provided image tools (whose names are group-prefixed) get the optimization too, with no integrator wiring.
- After a stream error, the previous message no longer disappears: `addMessage` now always appends and never replaces an existing (incomplete) message.

## 0.4.133

### Changed

- OpenAI-compatible provider now supports image generation: it inherits `imageGeneration` from the OpenAI provider (calls `/v1/images/generations`) instead of disabling it. Lets `generate_image` work for openai-compatible profiles. Note: endpoints without an images endpoint will now surface a network error from the provider instead of `"Image generation provider is not configured."`.

## 0.4.132

### Changed

- Tool-generated images (`generate_image`) are now stored in `storage.attachments` and the message keeps only a lightweight `{ data: { ref } }` marker instead of inline base64. The megabyte-scale payload no longer bloats threads and is no longer re-sent to the model on every turn — the model only ever sees the ref. The UI hydrates the image via `api.attachments` (works in both client-core and server-core modes). Legacy threads with inline base64 still render. Persistence is linked to the owning message/thread, so existing cascade deletes reclaim the image.

### Added

- `Attachment.source?: "user" | "tool"` — distinguishes tool-generated images from user uploads, letting the integrator's storage adapter route or apply policies (separate bucket, quotas, TTL) per source. Defaults to `"user"` when unset.

## 0.4.131

### Fixed

- Profile assignments are now read entity-scoped: `AssignmentsEngine.getAllAssignments(entityId?)` (and `AssignmentsStorage.readAll(entityId?)`) forward the scope token, and the profiles store passes `entityId` when loading assignments. The server-API client sends `?entityId=` (added `params: ["entityId"]` to the `getAllAssignments` route). With an `entityId` set, the chat/default profiles resolve from the agent's assignment, so `currentProfile` is populated and the composer input stays enabled even when the model picker is hidden.

## 0.4.130

### Added

- `Profile.headers` — custom HTTP headers sent with every request to the provider (gateway token, tenant id, custom `Authorization`, …). Merged into the OpenAI SDK client's default headers; an explicit `Authorization` wins over the api-key bearer.

```ts
const profile: Profile = {
  // …
  baseUrl: "https://gateway.example.com/v1",
  key: "",
  headers: { "X-Tenant": "acme", Authorization: "Bearer gw-token" },
};
```

### Changed

- OpenAI-family providers no longer send an `Authorization` header at all when no key (and no custom `Authorization`) is configured, so keyless OpenAI-compatible endpoints never receive a placeholder bearer.

## 0.4.129

### Changed

- `HostTool.requireApproval` is now wired into the real approval flow (it was previously dead). The engine reads it via `TMCPItem.requireApproval` when computing `autoAllow`, so it works even with a remote (server-side) engine: client-side host tools come back flagged auto-allow and run without a dialog round-trip.
  - **Behavior change:** host tools now auto-allow by default (per the documented `requireApproval` default of `false`) — a dialog is shown only when `requireApproval: true`. MCP / custom-server tools are unaffected and keep prompting.
- Removed the dead `HostToolSource.isAutoAllow()` method.

## 0.4.128

### Changed

- `onToolCallApproveResult` now receives the tool-call context as a second argument: `{ toolName, toolArgs, callId?, threadId? }` (new exported type `ToolCallApproveContext`). The first `result` argument is unchanged.

```tsx
<AIChatWidget
  onToolCallApproveResult={async (result, { toolName, toolArgs, callId, threadId }) => {
    /* result is tied to a specific tool call */
  }}
/>
```

## 0.4.127

### Fixed

- `toOpenAIChatCompletionStream` / `sendWithStreamOpenAI` now emit a native OpenAI error envelope (`{ error: { message, type, code, param } }`) when the provider fails mid-stream, instead of a `finish_reason: "stop"` chunk that read as success. New exported types `OpenAIStreamError` and `OpenAIStreamChunk`.

## 0.4.126

### Fixed

- One-shot calls (chat title generation, summarization, translation, OCR, vision, text analysis, image-gen text fallback, custom) now honour `profile.useResponsesApi` — `sendMessageSync` routes through the OpenAI Responses API instead of always using Chat Completions, so reasoning models (gpt-5+) work for these actions too.
- The custom streaming action now forwards `useResponsesApi` as well.

## 0.4.125

### Fixed

- Provider API errors now reliably surface in the chat as errors. The text-protocol tool fallback (`canUseTool: false` profiles) was rebuilding the terminal message and dropping its `status`, turning an error into a normal turn — it now forwards the incomplete/error status untouched.
- Mistral provider built its error response as plain `Error: ...` body text without a status, so failures rendered as a successful assistant reply. It now uses the standard `incomplete` / `error` status like every other provider.

## 0.4.124

### Fixed

- Tool-capability probe now mirrors the chat transport: it tries the Responses API and Chat Completions in parallel, so reasoning models (e.g. `gpt-5.5-pro`) that only call tools via `/v1/responses` are no longer mis-detected as `canUseTool: false`. `canUseTool` and `useResponsesApi` are now resolved together by a single `probeCapabilities` step and can no longer disagree.
- Text-protocol tool fallback now forwards the `useResponsesApi` flag to the provider.

## 0.4.123

### Changed

- `hideToolAllowAlways` now also accepts a `string[]` — hides the "Always allow" checkbox only for the listed tools (matched by full name `type_search` or bare name `search`). `true` still hides it for every tool.

```tsx
<AIChatWidget hideToolAllowAlways={["search", "fs_write"]} />
```

## 0.4.122

### Added

- `hideToolAllowAlways` config flag — hides the "Always allow" checkbox in the tool-confirmation dialog.
- `onToolCallApproveResult` callback — after the user clicks **Allow**, the dialog stays open in a pending state until the tool result resolves from the core stream, passes it to the callback, then closes and resumes the stream.

```tsx
<AIChatWidget
  hideToolAllowAlways
  onToolCallApproveResult={async (result) => {
    /* inspect / persist the tool result before the stream continues */
  }}
/>
```

## 0.4.121

### Changed

- Bundled theme CSS now ships only the white and night themes (dark / gray / classic-light / contrast-dark imports disabled in `themes.css`).

## 0.4.120

### Changed

- Model config form fields (provider/model combo boxes, API key / URL / name inputs) are now 24px tall.

## 0.4.119

### Changed

- MCP config editor: long lines now scroll horizontally inside the editor (vertical still grows with the page).

## 0.4.118

### Changed

- Non-primary (default) buttons now use normal font-weight; only primary buttons stay bold.
- Removed the trash icon from the Delete button in the edit-model card.

## 0.4.117

### Changed

- MCP tool action menus now always open bottom-left (was side-anchored / RTL-dependent).

## 0.4.116

### Added

- Chat history list is now grouped by date (Today / Yesterday / Previous 7 Days / Previous 30 Days / by month) — purely client-side from `lastEditDate`.

### Fixed

- Clicking the help (about) icon in a composer dropdown no longer toggles Extended Thinking — the toggle guard now recognizes clicks on the inner SVG icon.

### Changed

- Edit Configuration (MCP) no longer scrolls internally — the page handles scrolling, matching the permissions panel.

## 0.4.111

### Added

- `onOpenCustomProvider` widget config callback: when provided, a "Custom Providers" button (default variant) is shown next to "Add Model" on the AI Models page.

### Fixed

- Denying a tool call no longer crashes the chat with a duplicate-message-id error — the resume stream now updates the existing assistant message instead of re-adding it.

## 0.4.110

### Added

- `onCreatePromptFolder` widget config callback: when provided, the built-in "New prompt folder" dialog is skipped and the host owns the name-input UI, resolving the folder name (the widget still performs the creation).

### Changed

- `Input` height is now 24px everywhere (set on the component; removed per-call `h-[36px]` overrides).

## 0.4.109

### Changed

- Toggle button: taller track (18px) with a 1px border, vertically centered thumb that now travels fully to the edge; white theme on/off colors set to `#306ad9` / `#7f7f7f`.
- MCP permissions list no longer scrolls internally — scrolling is handled by the page.
- MCP permissions block is now a bordered panel (matching the config editor) holding the Permissions header and the tools list; removed the unused `Servers` `variant` prop.
- MCP config-editor language label now uses `--text-secondary` (was `--text-tertiary`), matching the header color.

## 0.4.104

### Changed

- Base typography: every widget surface (`.aui-root`, including the portal container) now defaults to 12px / 16px line-height; components override per-element.
- Dropped hard-coded `text-[11–15px]`, `text-xs`/`text-sm`, and `leading-[20px]`/`leading-[22px]` across the UI so they inherit the base.
- Chat history title is now 13px / 16px; ModelCard provider name is 10px / 14px.
- Default `Button` size is now 24px tall with 8px horizontal padding and bold text.
- Composer disclaimer text is now 10px.

## 0.4.99

### Changed

- Unified settings-page descriptions to a single style (12px / 16px line-height) and one color token (`--settings-description-color`); both description tokens now resolve to `--text-secondary` across all themes.

## 0.4.75

### Added

- Theme-aware provider logos: each provider resolves to its own `light`/`dark` icon via a provider→icon map. `openaicompatible` reuses the OpenAI logo; unmapped types fall back to a generic custom-provider icon.
- Dark-theme icons for every model-assignment task, and the **Code** task now shows the `code` icon.

### Changed

- Clicking anywhere in the composer (padding included) now focuses the input; clicks on its controls keep their own behavior.
- Chat text selection is now limited to message content and the composer input — the surrounding UI is no longer selectable.

### Fixed

- Composer attachment **+** button now follows the theme color (`stroke`) instead of a hard-coded fill.

## 0.4.74

### Changed

- OpenRouter is now listed first in the provider order, right after ONLYOFFICE.
- Add-profile card: re-entering an API key now keeps the currently selected model if the new key's list still contains it; otherwise it falls back to the first available model.

### Removed

- Dropped the tool-list cache from `SystemToolsSource` — `getTools` now re-enumerates on every call.

## 0.4.60

### Fixed

- `generate_image` result was not displayed: `ToolFallback` stripped the first `_` from the tool name when `getServerType` returned `""` (engine-side built-in tools are not registered in the UI `Servers` instance), turning `"generate_image"` into `"generateimage"` and failing the `isImageGeneration` check. Fixed by preserving the original name when no server type is found.

## 0.4.59

### Fixed

- OpenAI image generation failed with `400 Unknown parameter: 'response_format'` on `gpt-image-*` models — the provider always sent `response_format: "b64_json"`. It's now sent only for `dall-e-*` models; `gpt-image-*` returns base64 without it.

## 0.4.58

### Changed

- Added debug logging around the image-generation tool: `callImageGenerationTool` logs the tool call + args, and `OpenRouter.imageGeneration` logs the model + prompt when the provider request fires. Temporary instrumentation for diagnosing a hang.

## 0.4.57

### Changed

- Failed / cancelled assistant turns are now persisted to storage (with `status: { type: "incomplete", reason: "error" | "cancelled", error }`) instead of being transient UI-only state. Any text streamed before the error is preserved; on reload the message renders as "Error" / "Stopped".
- Empty persisted turns (an error/cancel before any delta) are kept out of the provider request history (`hasSendableContent` filter) so the next request isn't rejected for an empty assistant turn.

## 0.4.56

### Changed

- Add-profile card: the info icon and its "Download template" tooltip are now hidden together with the **Import** link when `onProfileImportClick` is not set (previously the icon stayed visible).

## 0.4.55

### Changed

- Add-profile card: the **Import** link is now hidden unless the host provides `onProfileImportClick` (previously always rendered, just inert without the callback).

## 0.4.54

### Added

- `AIChatWidget.onDeleteProfile?(profile) => boolean | Promise<boolean>` (also on `WidgetConfig`). When set, the built-in delete-confirmation dialog is skipped — the host shows its own UI and returns `true` to delete / falsy to cancel.
- `AIChatWidget.onDiscardMcpChanges?() => boolean | Promise<boolean>` (also on `WidgetConfig`). Fired when leaving the MCP tab with unsaved config edits; host returns `true` to discard and proceed, falsy to stay.
- `AIChatWidget.forceProxy` (and `AIEngineDeps.forceProxy: boolean | (() => boolean)`). Routes every non-`"external"` provider request through `PlatformAdapter.fetchProxy`, ignoring each profile's `useProxy`. No effect without `fetchProxy`.
- `onProfileImportClick` / `onDownloadTemplate` can now be passed directly as `AIChatWidget` props (previously only via `WidgetConfig`).

### Changed

- MCP servers page: "Edit configuration" shows the editor inline instead of in a modal. While open, the permissions list is dimmed (opacity 0.4) and non-interactive.
- Add-profile card: dropped the reserved error space from 0.4.46 that widened the gaps between fields; error text renders only when present.
- Custom scrollbar for fixed-height lists (dropdowns, model lists): thin, rounded thumb, themed hover via `--highlight-scroll-thumb-hover` (was the default OS scrollbar).

### Fixed

- "Enable/Disable all tools" only toggled one tool — the per-tool calls raced. Added a single `changeAllToolStatus(type, enabled)` store action.
- Disabled tools stayed callable in chat — the client tool payload (`actionArgs.tools`) wasn't filtered by the disabled map (the engine forwards user tools as-is). Now filtered in the servers store.
- Message **Save** / **Regenerate** did nothing for uuid message ids — both did `Number(message.parentId)` → `NaN`. Now resolve the parent by id.
- Info icon (`btn-menu-about`) rendered as a solid black circle — the stroke-only SVG needed `isStroke`.
- Chat-header settings icon showed horizontally; rotated 90° to vertical.
- A long field error (e.g. on the add-model form) widened the whole panel instead of truncating — the settings page wrapper, a flex child, had `min-width: auto` and got pinned to the form's min-content. Added `min-w-0` to the wrapper so it respects the container width.

## 0.4.53

- Fix: the tool-approval dialog never appeared for consumers that mount `ChatPage` directly instead of the full `AIChatWidget` — the dialog was wired only inside `AIChatWidget`. With server-side system tools (the first tools to require approval), the request hung in a pending state with no prompt. `ManageToolDialog` now lives inside `ChatPage` itself (wired to its own `useMessages`), so every consumer gets it; the duplicate mount was removed from `AIChatWidget`. The imperative `approveToolCall` / `denyToolCall` ref API is unchanged.

## 0.4.50

- Fix: system tools were leaking into `actionArgs.tools`, so the engine classified them as client-executed user tools — the approval dialog never opened and the browser hung trying to run a server-only tool. System tools now render as permission cards (`servers` / `systemTools`) but are kept out of the model payload; the engine injects and executes them server-side and surfaces them for approval as intended.

## 0.4.49

- System MCP tools now support stateful (session) Streamable HTTP servers (e.g. `docspace-mcp`). The core HTTP client sends `Accept: application/json, text/event-stream` on every request, captures `Mcp-Session-Id` from `initialize`, fires the `notifications/initialized` handshake, and echoes the session id on `tools/list` / `tools/call`. Stateless servers (no session id in the response) keep working unchanged. Protocol version bumped to `2025-06-18`. Public `listTools` / `callTool` signatures are unchanged.

## 0.4.48

- Server-side "system" MCP tools. Hosts wire trusted MCP servers (HTTP) on the server; their tools are enumerated and executed in-engine, so credentials never reach the browser. New exports: `SystemToolsSource`, `composeToolsAdapters`, `AIEngineDeps.systemServerTypes`, `ToolsEngineDeps.systemToolsSource`, `ToolsEngine.listSystemTools` (route `tools/list-system-tools`).
- Unlike other adapter tools, system tools pause for UI approval, then execute server-side on approve (`tool-call-pending` carries `serverExecuted`). They render as permission cards (one fetch, no browser MCP connection), enable/disable via the normal flow, never touch `storage.mcpServers` — so they stay out of the config editor and can't be deleted.

```ts
const systemTools = new SystemToolsSource({
  servers: { weather: { url: "https://mcp...", headers: { Authorization: "Bearer …" } } },
});
new AIEngine({ storage, toolsAdapter: composeToolsAdapters(systemTools, hostAdapter), systemServerTypes: () => systemTools.getServerTypes() });
new ToolsEngine({ storage, systemToolsSource: systemTools });
```

> `listSystemTools` is a new `DEFAULT_TOOLS_ROUTES` entry — route layers that bind every entry to a controller must add a handler.

## 0.4.47

- Add-profile and edit-profile cards: the primary action button ("Add model" / "Save changes") now shows a loading spinner and stays disabled while the create/update request is in flight. Tracked via a dedicated `isSubmitting` state so the spinner appears only on submit, not during model-list fetching.

## 0.4.46

- Fix the CSP-blocked icon rendering under strict `connect-src` hosts (the issue from 0.4.40 that 0.4.41/0.4.43 attempted unsuccessfully). Bundled SVG icons are now compiled to React components at build time via `vite-plugin-svgr` and rendered inline — no `data:` URLs, no `react-svg` fetch, no separate asset files to deploy. `<ImagesContextValue>` gains `getBundledIcon(name)`; `<Icon>` resolves icons in order: host component override → bundled SVG component → host URL override (still via `react-svg`) → bundled PNG via `<img>`.
- Add-profile and edit-profile cards: error space is now reserved for every field so the card no longer jumps when an error appears/disappears in vertical layout. Error text truncates instead of expanding the parent (`min-w-0` on `FieldContainer`).

## 0.4.45

- `"external"` provider is hidden from the Add-profile provider dropdown. External profiles are host-managed (the transport lives in `PlatformAdapter.externalFetch` and `basedOn` has no UI) — hosts create them programmatically via `addProfile({ providerType: "external", basedOn: "openai", ... })`.

## 0.4.44

- Revert the icon-rendering rework from 0.4.43 — it regressed icon display in some hosts. Back to the 0.4.42 behaviour (SVG icons inlined as `data:` URLs and rendered through `react-svg`). The original CSP issue from 0.4.40 stays open and will be addressed differently.

## 0.4.43

- Fix the CSP fallout from 0.4.41 without re-introducing the asset-deploy regression. SVG icons stay inlined as `data:` URLs in the bundle (so the JS bundle remains self-contained — hosts that didn't copy `dist/assets/` were silently losing icons after 0.4.41). The `<Icon>` component now detects data URLs and decodes the SVG markup in-place via `dangerouslySetInnerHTML`, then applies the same color/stroke logic via a ref instead of going through `react-svg`'s `fetch()`. `react-svg` stays as a fallback for hosts that override `getImageSrc` to return a network URL. The `?no-inline` query + custom `assetFileNames` from 0.4.41 are reverted.

## 0.4.42

- `AIChatWidget` / `WidgetConfig` gain `isAddModelCardHorizontal?: boolean`. Routes the two-row "Add model" form layout to both the Settings → AI Models page and the InitialSetup screen the chat surface falls back to when no profiles are configured. `<Settings />`'s existing prop of the same name remains as a per-instance override. InitialSetup defaults to horizontal (unchanged behaviour); Settings defaults to vertical.
- Composer profile picker now truncates long names instead of overflowing. The "Ask" label gets `shrink-0`, the `ComboBox` slot is wrapped in `min-w-0 flex-1` so the existing inner `truncate` actually triggers.
- Settings page no longer ships with a hard-coded 640px width. `w-[640px]` → `w-full max-w-[640px] min-w-0`, so the page caps at 640px on wide hosts but shrinks to fit narrow side panels — previously the whole AI Models card (background, fields, error text) clipped off the right edge in narrow hosts.

## 0.4.41

- SVG assets are no longer inlined as `data:` URLs in the bundle. Vite's lib mode ignores `assetsInlineLimit` and force-inlines every asset; the `<Icon>` component renders SVGs through `react-svg`, which `fetch()`es the src — and strict host CSPs (`connect-src *` style) reject the `data:` scheme. SVGs now emit as hashed files under `dist/assets/<name>-<hash>.svg` via a `?no-inline` query in `src/shared/images.ts`. CSS keeps its stable `dist/styles/index.css` path; other assets fall into `dist/assets/[name]-[hash][extname]`.

## 0.4.40

- "Analyzing" indicator in the chat surface is now deferred by 400ms after the stream starts. Fast responses that arrive within that window never show the indicator (no more flash); the hide edge stays immediate.

## 0.4.39

- New `WidgetConfig.onDownloadTemplate?: () => void` callback. Wired to the "Download template" link in the add-profile card's info tooltip; without it the link stays inert. Hosts use it to serve a downloadable JSON template for their custom providers.
- `WidgetConfig.onProfileImportClick` is now optionally async and may return a `Partial<ModelFormValues>` to pre-fill the add-profile form after a successful import. Returning `null` / `undefined` / nothing (or a sync `() => void` — backward compatible) leaves the form untouched. When `provider` and `baseUrl` are returned, the model list is refreshed automatically and any imported `model` is preserved if it appears in the upstream list.

```ts
<AIChatWidget
  onProfileImportClick={async () => {
    const data = await pickAndParseTemplate();
    if (!data) return null;
    registerProvider(data.providerType, data.providerClass);
    return {
      provider: data.providerType,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      model: data.modelId,
      profileName: data.suggestedName,
    };
  }}
  onDownloadTemplate={() => host.downloadFile("custom-provider-template.json")}
/>
```

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
