# Changelog

## [Unreleased]

### Changed

- The Web Search settings page can now be fully restyled by the host through the `className` prop and the stable `web-search-*` classes (`web-search-root`, `web-search-fields`, `web-search-field-header`, …): field-column gaps and `max-width`, header label size/weight, and the "Get API key" link color (via `--link-secondary-color`) — all from the host's own stylesheet.
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
