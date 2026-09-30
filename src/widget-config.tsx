import { createContext, useContext, useMemo } from "react";
import { setLogLevel, type LogLevel } from "./shared/logger";
import { setVerboseExport } from "./utils";
import type { SystemPromptOverride } from "./core/actions";
import type { AssistantAction } from "./ui/pages/chat/assistant-actions";
import type { ComposerAction } from "./ui/pages/chat/composer-actions";
import type { ProfilePickerAction } from "./ui/pages/chat/profile-picker-actions";
import type { Suggestion } from "./ui/pages/chat/suggestions";
import type { ModelFormValues } from "./ui/components/model-config-cards/sub-components/ModelConfigForm";
import type { ChatErrorPayload } from "./core/services";
import type { Profile, Thread } from "./types";

export interface WidgetConfig {
  /**
   * Opaque scope token for entity-bound chat ("rooms"). When set, the
   * widget shows only threads belonging to this entity, new threads are
   * created in this scope, and `assignments.resolveForAction(Chat, …)`
   * receives this id so the storage layer can return an entity-specific
   * chat profile instead of the global Chat assignment.
   *
   * The core (engines / actions) treats this value as opaque and only
   * passes it through to storage methods — entity lifecycle and the
   * "which profile per entity" mapping live entirely on the host side.
   *
   * Live switching is supported since 0.4.170: config consumers (threads
   * hydration, sends) pick the new value up on the next render, and the
   * host must mirror the change into the store bundle via
   * `Stores.setEntityId` plus the re-scoping steps documented there.
   */
  entityId?: string;
  /**
   * Secondary scope for the *context* of chat rounds, when the
   * conversation itself lives under {@link WidgetConfig.entityId} but the
   * request should run against another workspace's context — its tool
   * list / execution scope, allow-always tool preferences, and assignment
   * fallback. Threads (history placement and listing) keep following
   * `entityId`. Hosts use this to talk to an AI agent from outside its
   * room while the chat history stays where the user is. Forwarded on
   * send / regenerate / tool-call resume; omitted → requests behave as
   * before (everything scopes by `entityId`).
   */
  contextEntityId?: string;
  /**
   * Global cursor-pagination switch (default `false`). When enabled:
   *
   * - the sidebar loads threads in pages of 100 and infinite-scrolls;
   * - every full-history read (opening a thread, building the model's
   *   request history, download/export) fetches messages in pages of
   *   100 instead of one unbounded request.
   *
   * Requires a `StorageAdapter` / backend that honors the `count` /
   * `cursor` parameters on `threads.readAll` and
   * `messages.readByThread` (see the storage contract docs). With the
   * flag off, no pagination parameters are ever sent — the behavior is
   * identical to previous releases.
   */
  enablePagination?: boolean;
  /**
   * Controls the composer's model (profile) picker. Tri-state:
   *
   * - `true` — always hidden.
   * - `false` — always shown, even when {@link WidgetConfig.entityId} is set.
   * - omitted — hidden when `entityId` is set (legacy heuristic for
   *   entity chats with a host-fixed profile), shown otherwise.
   */
  hideProfilePicker?: boolean;
  /**
   * Render the composer's model (profile) picker as read-only: the current
   * profile's name is shown as plain static text (secondary color, no
   * dropdown arrow) and cannot be changed from the UI. The profile is still
   * resolved from the profiles store, so hosts that fix the profile
   * programmatically can surface which model answers without letting the
   * user switch it. Implies the picker area is visible, so the
   * {@link WidgetConfig.entityId} default-hide heuristic does not apply;
   * an explicit {@link WidgetConfig.hideProfilePicker} `true` still hides
   * everything.
   */
  profilePickerReadOnly?: boolean;
  /**
   * Hide the floating "scroll to bottom" button in the chat thread. The
   * button sits just above the composer and appears only while the thread is
   * scrolled up, hiding itself once the user is back at the latest message.
   * Shown by default; set to `true` to remove it entirely.
   */
  hideScrollToBottomButton?: boolean;
  /**
   * Hide the top and bottom fade overlays in the chat thread. The fades blend
   * the message content into the panel background at both edges of the scroll
   * area. Shown by default; set to `true` to remove them entirely.
   */
  hideThreadFade?: boolean;
  /**
   * Hide the settings (gear) button in the header. The settings page itself
   * remains reachable programmatically via the router store.
   */
  hideSettingsButton?: boolean;
  /**
   * Icon name for the chat-history panel's close button (top-right).
   * Defaults to `"btn-close"` (the "X" close icon). When the widget is embedded in
   * a host panel that already provides its own close button, set this to
   * `"btn-arrow-up"` to show a back/collapse arrow instead, avoiding two
   * stacked "X" close controls.
   */
  chatHistoryCloseIcon?: "btn-close" | "btn-arrow-up";
  /**
   * Which edge the search input's magnifier icon sits on (currently the
   * chat-history search field). `"end"` (default) keeps the icon at the
   * trailing edge, where it is replaced by the clear ("X") button while
   * typing. `"start"` moves the magnifier to the leading edge, where it stays
   * visible during input, and the clear button always stays at the trailing
   * edge.
   */
  inputIconPosition?: "start" | "end";
  /**
   * Hide the chat-history panel's header row (the "Chat history" title and its
   * close button). The search field and the thread list stay visible. Use this
   * when the widget is embedded in a host panel that already provides its own
   * title bar and close control, to avoid a duplicated header.
   */
  hideChatHistoryHeader?: boolean;
  /**
   * Show each chat-history thread's actions trigger permanently instead
   * of only revealing it on hover. Useful on touch devices or when the menu
   * should always be discoverable.
   */
  chatHistoryAlwaysShowActions?: boolean;
  /**
   * Show the "Clear history" item in each chat's context menu (the "…"
   * dropdown in the chat-history list). Hidden by default; set to `true` to
   * expose it.
   *
   * When hidden (default), the menu's separator sits before "Delete" so the
   * destructive action is visually set apart. When shown, "Delete" keeps its
   * place and the separator moves below it, ahead of "Clear history".
   */
  showClearHistory?: boolean;
  /**
   * How nested submenus are presented in dropdown menus.
   * - `"flyout"` (default) — side flyouts that open on hover/click. Can
   *   overflow narrow or embedded hosts (iframe, mobile, side panels).
   * - `"drilldown"` — clicking a row with a submenu replaces the current
   *   level's content with the next level, with a "back" row to return.
   *   Keeps everything inside the menu's own bounds.
   *
   * Can be overridden per menu via `DropdownMenu`'s `navigation` prop.
   */
  dropdownNavigation?: "flyout" | "drilldown";
  /**
   * Icon name for the chevron/arrow of the regular comboboxes (the select
   * fields in settings forms). Defaults to `"arrow"`. Provide the icon itself
   * via the `images` override if it isn't a bundled name. The composer's model
   * selector is configured separately via
   * {@link WidgetConfig.modelSelectorArrowIcon}, so the two can differ.
   */
  comboBoxArrowIcon?: string;
  /**
   * Icon name for the chevron/arrow of the composer's model selector combobox.
   * Defaults to `"arrow"` (same as the regular comboboxes). Set it to give the
   * model selector a distinct arrow without affecting the form comboboxes.
   *
   * Only the glyph is configurable — both arrows render at a fixed `7` x `4`.
   */
  modelSelectorArrowIcon?: string;
  /**
   * Hide the "Always allow" checkbox in the tool-call confirmation dialog.
   * When hidden, the host can only approve/deny a single call at a time and
   * cannot opt into persisting the allow decision for the tool.
   *
   * - `true` — hide for every tool.
   * - `string[]` — hide only for the listed tool names. Matched against the
   *   full tool name (e.g. `"type_search"`) first, then the bare name with
   *   the `<serverType>_` prefix stripped (e.g. `"search"`), so either form
   *   works.
   * - `false` / omitted — always show the checkbox.
   */
  hideToolAllowAlways?: boolean | string[];
  /**
   * Fully takes over the click on the header settings button. When provided,
   * the default behavior (`router.setCurrentPage("settings" | "chat")`) is
   * NOT invoked — the host is responsible for any navigation, modal, etc.
   */
  onSettingsClick?: () => void;
  /**
   * Forces the header settings button into its active (highlighted) state.
   * Useful when `onSettingsClick` renders an external panel whose open state
   * the widget's router doesn't know about. When `undefined`, falls back to
   * the internal rule (`currentPage === "settings"`).
   */
  isSettingsActive?: boolean;
  /**
   * Renders every built-in dialog in fullscreen mode (100% of the portal
   * container, no header close button). Per-call `<DialogContent isFullscreen>`
   * still wins when explicitly passed.
   */
  isDialogFullscreen?: boolean;
  /**
   * Override (replace or append) for the built-in chat system prompt.
   * Forwarded as `actionArgs.prompt` on every `sendWithStream`,
   * `approveToolCall`, and `denyToolCall` so the override survives the
   * tool-call round-trip. Untouched by the engine/actions otherwise —
   * see {@link SystemPromptOverride}.
   */
  systemPrompt?: SystemPromptOverride;
  /**
   * Extra buttons rendered in the action bar under each assistant message,
   * appended after the built-in Copy and Save. Each action receives the
   * plain text (and Markdown / raw message) of the assistant message on
   * click. Hidden during streaming and on error states, identical to the
   * built-ins.
   */
  assistantActions?: AssistantAction[];
  /**
   * Extra items appended to the composer's "+" (attachments) dropdown,
   * rendered above the built-in Web Search / Extended Thinking block. Each
   * item is an onClick-only entry; toggles and submenus are not supported.
   */
  composerActions?: ComposerAction[];
  /**
   * Extra items appended to the composer's model (profile) picker dropdown,
   * rendered after a separator below the profile list. Each entry is either
   * an onClick item or, when `items` is set, a row opening a nested submenu
   * (presented per {@link WidgetConfig.dropdownNavigation}). Not rendered
   * when the picker itself is hidden — see
   * {@link WidgetConfig.hideProfilePicker}.
   */
  profilePickerActions?: ProfilePickerAction[];
  /**
   * Fired when the user explicitly picks an entry in the composer's model
   * picker — a plain profile row (`actionId` undefined) or a
   * {@link ProfilePickerAction} row carrying a `profileId` (`actionId` is
   * that action's id, and `profile` is the aliased profile as selected,
   * i.e. named after the action's `text`). NOT fired by programmatic
   * changes: the initial auto-select, thread-switch profile restores, or
   * host calls to the profiles store.
   */
  onProfilePickerSelect?: (profile: Profile, actionId?: string) => void;
  /**
   * Show the built-in "Add local image" item in the composer's "+"
   * (attachments) dropdown. Opt-in: the item appears only when this is `true`.
   * `false` / omitted hides it. The item rides on an internal HTML `<input>`
   * (not on `PlatformAdapter.file`), so enabling it needs no host file
   * capability.
   */
  addLocalImageEnabled?: boolean;
  /**
   * Pixel size of the send / stop glyph inside the composer's action button.
   * Defaults to `17`. Use this in hosts that need a larger or smaller send
   * icon; the button box around it is `composerActionSendBoxSize`.
   */
  composerActionSendSize?: number;
  /**
   * Pixel size of the send / stop button box itself — the square that carries
   * the accent fill. Defaults to `24`, so the glyph (`composerActionSendSize`)
   * sits inside with padding, and the whole action row is centred on it.
   */
  composerActionSendBoxSize?: number;
  /**
   * Pixel size of the action buttons below assistant and user messages —
   * copy, regenerate, edit, save, "more" — covering both the icon and its
   * square button box. Defaults to `20`.
   *
   * Numeric on purpose: the size is handed to the icon component, so a host
   * that shadows one of these glyphs through the `images` override keeps
   * control of how big it draws itself.
   */
  chatMessageActionsIconSize?: number;
  /**
   * Pixel size of the leading icon of a labeled form field (the optional
   * glyph before the field header). Defaults to `20`.
   */
  fieldContainerIconSize?: number;
  /**
   * Pixel size of the "about"/info icon buttons — the model form's Import
   * help trigger and each dropdown item's about button. Defaults to `20`.
   * The glyph itself can be swapped via the `images` override of
   * `btn-menu-about`.
   */
  aboutButtonSize?: number;
  /**
   * Disable the composer entirely. The input becomes non-editable (no
   * typing, no Enter-to-send) and every composer control — attachments,
   * prompts, model selector, send — is made non-interactive and dimmed.
   * Pair it with {@link WidgetConfig.composerHeader} to explain why (e.g.
   * an "AI features aren't active" banner). The composer root also carries
   * a `composer-disabled` class for host CSS targeting. Defaults to `false`.
   */
  composerDisabled?: boolean;
  /**
   * Placeholder text shown in the (empty) composer input. Overrides the
   * built-in localized "Ask anything…" string. Not translated — the host
   * supplies the exact text to display. Omit to keep the built-in string.
   */
  composerPlaceholder?: string;
  /**
   * Show the welcome screen (title + description) at the top of a new (empty)
   * chat. Opt-in: hidden by default, set to `true` to render it. The title and
   * description come from {@link WidgetConfig.welcomeTitle} /
   * {@link WidgetConfig.welcomeDescription} (or their built-in localized
   * strings when those are omitted).
   */
  showWelcome?: boolean;
  /**
   * Title shown on the welcome screen of a new (empty) chat. Overrides the
   * built-in localized "WelcomeTitle" string. Not translated — the host
   * supplies the exact text to display. Omit to keep the built-in string.
   */
  welcomeTitle?: string;
  /**
   * Description shown under the title on the welcome screen of a new (empty)
   * chat. Overrides the built-in localized "WelcomeDescription" string. Not
   * translated — the host supplies the exact text to display. Omit to keep
   * the built-in string.
   */
  welcomeDescription?: string;
  /**
   * Clickable prompt suggestions shown above the composer in a new
   * (empty) chat only. Each item is `{ name, prompt }`; clicking inserts
   * its `prompt` into the composer input. Capped at 20 — extras are
   * ignored.
   */
  suggestions?: Suggestion[];
  /**
   * Arbitrary content rendered at the very top of a new (empty) chat
   * (above the welcome screen, with a 12px top offset). Rendered whenever a
   * node is provided, independent of {@link WidgetConfig.suggestions} — pass
   * no node to opt out.
   */
  suggestionsHeader?: React.ReactNode;
  /**
   * Arbitrary content rendered directly above the composer, in both the
   * empty and non-empty chat states. Use it to inject a host-owned banner
   * or notice — e.g. an "AI features aren't active" call-to-action. Spans
   * the composer's width; the host owns the markup and styling. Omit to
   * render nothing.
   */
  composerHeader?: React.ReactNode;
  /**
   * Handler for the "Import" link in the add-profile card. The host
   * owns the entire import flow (file picker, parsing, registering a
   * custom provider via `registerProvider`, etc.); the widget only
   * calls `preventDefault` on the anchor before invoking the callback.
   *
   * Return value (optional, awaited):
   * - `Partial<ModelFormValues>` — fields to pre-fill in the
   *   add-profile form. Provided fields are merged onto the current
   *   values; absent fields are left untouched. When `provider` and
   *   `baseUrl` are present, the model list is refreshed automatically
   *   and any imported `model` is preserved if it appears in that
   *   list.
   * - `null` / `undefined` / no return — leave the form as is (use
   *   this on cancel or error).
   *
   * Synchronous `() => void` handlers from older hosts remain valid
   * — they fall under the "no return" case.
   */
  onProfileImportClick?: () =>
    | void
    | Partial<ModelFormValues>
    | null
    | Promise<Partial<ModelFormValues> | null | void>;
  /**
   * Render the "Add model" form in a two-row (horizontal) layout
   * instead of the default single-column stack. Honored both by the
   * Settings → AI Models page and the InitialSetup screen the chat
   * surface falls back to when no profiles are configured. Use this
   * in wider hosts where the extra horizontal space is available.
   */
  isAddModelCardHorizontal?: boolean;
  /**
   * Persist the Web Search settings on an explicit Save button instead of
   * saving implicitly on input blur / provider select.
   * @default "blur"
   */
  webSearchSaveMode?: "blur" | "button";
  /**
   * Handler for the "Download template" link shown in the add-profile
   * card's info tooltip. Used by hosts that ship a downloadable JSON /
   * config template for custom providers. The widget calls
   * `preventDefault` on the underlying anchor; everything else (fetch,
   * save dialog, etc.) is the host's responsibility. When omitted, the
   * link remains inert.
   */
  onDownloadTemplate?: () => void;
  /**
   * Handler for opening a host-owned "Custom Providers" screen. When
   * provided, a "Custom Providers" button is shown next to "Add Model"
   * on the AI Models settings page; clicking it invokes this callback.
   * When omitted, the button is not rendered.
   */
  onOpenCustomProvider?: () => void;
  /**
   * Custom confirmation for deleting a profile (AI model). When provided,
   * the widget's built-in confirmation dialog is NOT shown — the host owns
   * the confirmation UI (e.g. its own modal) and resolves the result:
   * - `true` — the widget proceeds with the deletion
   * - `false` / `undefined` / no return (or a rejected promise) — cancelled,
   *   nothing is deleted
   *
   * The widget always performs the actual deletion itself on confirm; the
   * host only owns the confirmation step. When omitted, the built-in
   * confirmation dialog is used.
   */
  onDeleteProfile?: (
    profile: Profile
  ) => boolean | void | Promise<boolean | void>;
  /**
   * Custom confirmation for deleting a chat (thread). When provided, the
   * widget's built-in confirmation dialog is NOT shown — the host owns the
   * confirmation UI (e.g. its own modal) and resolves the result:
   * - `true` — the widget proceeds with the deletion
   * - `false` / `undefined` / no return (or a rejected promise) — cancelled,
   *   nothing is deleted
   *
   * The widget always performs the actual deletion itself on confirm; the
   * host only owns the confirmation step. When omitted, the built-in
   * confirmation dialog is used.
   */
  onDeleteThread?: (thread: Thread) => boolean | void | Promise<boolean | void>;
  /**
   * Custom UI for creating a new prompt folder. When provided, the widget's
   * built-in "New prompt folder" dialog is NOT shown — the host owns the
   * input UI (e.g. its own modal) and resolves the folder name:
   * - a non-empty string — the widget creates the folder (and saves the
   *   prompt into it)
   * - `""` / `undefined` / no return (or a rejected promise) — cancelled,
   *   nothing is created
   *
   * The widget always performs the actual creation itself; the host only
   * owns the name-input step. When omitted, the built-in dialog is used.
   *
   * @param defaultName suggested folder name (the localized "New folder")
   */
  onCreatePromptFolder?: (
    defaultName: string
  ) => string | void | Promise<string | void>;
  /**
   * Custom UI for renaming a prompt folder. When provided, the widget's
   * built-in "Rename folder" dialog is NOT shown — the host owns the input
   * UI (e.g. its own modal) and resolves the new folder name:
   * - a non-empty string — the widget renames the folder
   * - `""` / `undefined` / no return (or a rejected promise) — cancelled,
   *   the folder keeps its current name
   *
   * The widget always performs the actual rename itself; the host only
   * owns the name-input step. When omitted, the built-in dialog is used.
   *
   * @param currentName the folder's current name (to prefill the input)
   * @param folderId the id of the folder being renamed
   */
  onRenamePromptFolder?: (
    currentName: string,
    folderId: string
  ) => string | void | Promise<string | void>;
  /**
   * Custom UI for deleting a prompt folder. When provided, the widget's
   * built-in "Delete folder" confirmation dialog is NOT shown — the host owns
   * the confirmation UI (e.g. its own modal) and resolves whether to proceed:
   * - `true` — the widget deletes the folder
   * - `false` / `undefined` / no return (or a rejected promise) — cancelled,
   *   the folder is kept
   *
   * The widget always performs the actual deletion itself; the host only owns
   * the confirmation step. When omitted, the built-in dialog is used.
   *
   * @param currentName the folder's current name (to show in the confirmation)
   * @param folderId the id of the folder being deleted
   */
  onDeletePromptFolder?: (
    currentName: string,
    folderId: string
  ) => boolean | void | Promise<boolean | void>;
  /**
   * Custom UI for deleting a saved prompt. When provided, the widget's
   * built-in "Delete prompt" confirmation dialog is NOT shown — the host owns
   * the confirmation UI (e.g. its own modal) and resolves whether to proceed:
   * - `true` — the widget deletes the prompt
   * - `false` / `undefined` / no return (or a rejected promise) — cancelled,
   *   the prompt is kept
   *
   * The widget always performs the actual deletion itself; the host only owns
   * the confirmation step. When omitted, the built-in dialog is used.
   *
   * @param currentName the prompt's name (to show in the confirmation)
   * @param promptId the id of the prompt being deleted
   */
  onDeletePrompt?: (
    currentName: string,
    promptId: string
  ) => boolean | void | Promise<boolean | void>;
  /**
   * Custom UI for creating a prompt. When provided, the widget's built-in
   * "Save prompt" path (which auto-names from the message) is replaced — the
   * host owns the name/text input UI (e.g. its own window) and resolves the
   * prompt fields:
   * - a {@link PromptDraft} with a non-empty `name` — the widget creates the
   *   prompt (in the same folder it was triggered from)
   * - `undefined` / no return / empty `name` (or a rejected promise) —
   *   cancelled, nothing is created
   *
   * The widget always performs the actual creation itself; the host only
   * owns the input step. When omitted, the prompt is saved directly with a
   * name derived from the message text.
   *
   * @param draft suggested fields — `name` (message text, truncated), the
   *   full `text`, the target `folderId` (`null` for the root list), and
   *   `folders` (all existing prompt folders, for a folder picker). Return a
   *   {@link PromptResult}; set its `folderId` to choose where to save
   *   (omit it to keep the suggested one).
   */
  onCreatePrompt?: (
    draft: PromptDraft & {
      folderId: string | null;
      folders: PromptFolderInfo[];
    }
  ) => PromptResult | void | Promise<PromptResult | void>;
  /**
   * Custom UI for editing a prompt. When provided, the widget's built-in
   * "Edit prompt" dialog is NOT shown — the host owns the input UI (e.g. its
   * own window) and resolves the updated fields:
   * - a {@link PromptDraft} with a non-empty `name` — the widget saves the
   *   update
   * - `undefined` / no return / empty `name` (or a rejected promise) —
   *   cancelled, nothing is changed
   *
   * The widget always performs the actual update itself; the host only owns
   * the input step. When omitted, the built-in dialog is used.
   *
   * @param prompt the current prompt being edited (`id`, `name`, `text`, its
   *   `folderId`, `null` when in the root list, and `folders` — all existing
   *   prompt folders, for a folder picker). Return a {@link PromptResult}; set
   *   its `folderId` to move the prompt (omit it to keep the current folder).
   */
  onEditPrompt?: (
    prompt: PromptDraft & {
      id: string;
      folderId: string | null;
      folders: PromptFolderInfo[];
    }
  ) => PromptResult | void | Promise<PromptResult | void>;
  /**
   * Confirmation gate fired when the user navigates away from the MCP
   * servers tab while the inline config editor holds unsaved edits. The
   * host shows its own warning UI and resolves the result:
   * - `true` — discard the edits and proceed with the navigation
   * - `false` / `undefined` / no return (or a rejected promise) — stay on
   *   the MCP tab, keeping the edits
   *
   * When omitted, navigation proceeds without prompting (edits are
   * dropped, as before).
   */
  onDiscardMcpChanges?: () => boolean | void | Promise<boolean | void>;
  /**
   * Invoked after the user approves a tool call, once its result has been
   * resolved from the core stream — but BEFORE the confirmation dialog
   * closes and the stream continues. The dialog stays open in a pending
   * (loading) state from the "Allow" click until this callback settles, so
   * the host can inspect/persist the result synchronously or await async
   * work. The result is passed through unchanged; returning a value does
   * not alter it. Once the callback settles, the dialog closes and the
   * stream resumes.
   *
   * The second argument carries the tool-call context the result belongs
   * to: the (fully-qualified) `toolName`, the `toolArgs` the model called
   * it with, the provider `callId` (when present), and the `threadId`.
   */
  onToolCallApproveResult?: (
    result: unknown,
    ctx: ToolCallApproveContext
  ) => void | Promise<void>;
  /**
   * Rewrites the text and the action of the in-chat assistant error box.
   * Called before the widget renders, with the normalized
   * {@link ChatErrorPayload} — branch on `payload.code` (e.g.
   * `"insufficient_funds"`, `"auth"`, `"rate_limit"`), never on the
   * provider's message text — and the {@link ChatErrorContext} the error
   * belongs to.
   *
   * Return a {@link ChatErrorOverride} to replace the title, the
   * description, or the button; every field is optional and an omitted one
   * keeps the widget's default. Return `null` / `undefined` for the codes
   * you don't handle. The box itself — layout, fill, `role="alert"` — stays
   * library-owned, so a host cannot break the chat's appearance; a throw is
   * caught and logged and the defaults are used.
   *
   * @example
   * ```tsx
   * formatChatError={(payload) =>
   *   payload.code === "insufficient_funds"
   *     ? {
   *         title: t("WalletEmpty"),
   *         description: t("TopUpToContinue"),
   *         action: { text: t("TopUp"), onClick: () => goToWallet() },
   *       }
   *     : null
   * }
   * ```
   */
  formatChatError?: (
    payload: ChatErrorPayload,
    ctx: ChatErrorContext
  ) => ChatErrorOverride | null | undefined;
  /**
   * Takes over files arriving on the chat surface — both a drag-and-drop
   * and a clipboard paste (a pasted screenshot is a `File` like any other).
   * When provided, the raw {@link File} list goes to this callback and the
   * widget's built-in handling (reading images as data URLs / text files as
   * text and attaching them in-memory, ignoring binary Office/PDF drops) is
   * skipped entirely. Use this to route every incoming file through the same
   * path as the composer's upload button — e.g. a host that uploads to
   * portal storage and attaches by file id.
   *
   * Hosts whose backend cannot persist a base64 draft (DocSpace, whose
   * `attachments/save-image*` routes are unmounted) **must** provide this:
   * it is the only path by which an image reaches the chat there.
   *
   * The drag-over highlight/overlay is still driven by the widget; only the
   * payload handling is delegated. When omitted, the built-in
   * read-and-attach behavior is used.
   */
  onDropFiles?: (files: File[]) => void | Promise<void>;
  /**
   * Minimum severity that reaches the console. The library logs through a
   * single module-global logger; setting this raises the threshold so noisy
   * `info`/`debug` tracing (MCP startup, image generation, …) is suppressed:
   * - `"debug"` (default) — log everything, unchanged behavior.
   * - `"warn"` — drop `info`/`debug`, keep warnings and errors.
   * - `"error"` — errors only.
   * - `"silent"` — suppress all output.
   *
   * Applies globally (the logger is a singleton), not per widget instance.
   * When omitted, the current level is left untouched, so a host that calls
   * the exported `setLogLevel` directly is not overridden.
   */
  logLevel?: LogLevel;
  /**
   * Debug export mode: when `true`, every export/copy path writes the full
   * message model into the produced document instead of only the
   * user/assistant prose — tool calls with their arguments and results,
   * reasoning blocks and attachment markers are all included, nothing is
   * cut out.
   *
   * Intended for hosts that opened the editor in debug mode, so a support
   * engineer can save a chat and see exactly what the model did.
   *
   * Applies globally (the serializers are module-level, like the logger),
   * not per widget instance. When omitted, the current state is left
   * untouched, so a host that calls the exported `setVerboseExport`
   * directly is not overridden.
   *
   * This flag can only turn verbose export *on*. The desktop editor's own
   * debug build enables it independently — it appends a `DebugMode` token to
   * the User-Agent — and `debugExport: false` does not switch that off.
   */
  debugExport?: boolean;
}

/** Prompt fields exchanged with the host's create/edit windows. */
export interface PromptDraft {
  name: string;
  text: string;
}

/** Minimal prompt folder shape passed to the host for folder pickers. */
export interface PromptFolderInfo {
  id: string;
  name: string;
}

/**
 * Resolved prompt fields returned by the host's create/edit windows — the
 * {@link PromptDraft} plus an optional `folderId` choosing the target folder
 * (`null` for the root list). When `folderId` is omitted, the widget keeps
 * the folder the action was triggered from.
 */
export interface PromptResult extends PromptDraft {
  folderId?: string | null;
}

/** Context passed to {@link WidgetConfig.formatChatError} alongside the payload. */
export interface ChatErrorContext {
  /** Thread the errored turn belongs to; empty for a not-yet-persisted chat. */
  threadId?: string;
  /**
   * Title the widget would render by default — the localized
   * `ChatError.<code>` string for a known code, otherwise the provider's
   * `payload.message`. Use it to decorate instead of replacing.
   */
  defaultTitle: string;
  /** Description the widget would render by default: the error code. */
  defaultDescription: string;
}

/**
 * Host replacement for the error box's text and action, returned from
 * {@link WidgetConfig.formatChatError}. Every field is optional — omit one
 * to keep the widget's default for that slot.
 */
export interface ChatErrorOverride {
  /** Replaces the box's title line. */
  title?: string;
  /** Replaces the line below the title, which defaults to the error code. */
  description?: string;
  /**
   * Replaces the built-in "Retry" button:
   * - omitted — the default Retry, which replays the errored turn
   * - `null` — no button at all, for errors that retrying cannot fix
   * - `{ text }` — Retry's behavior under a different label
   * - `{ onClick }` — the host's own action instead of a retry
   *
   * A throw from `onClick` is caught and logged.
   */
  action?: ChatErrorAction | null;
}

/** Button descriptor for {@link ChatErrorOverride.action}. */
export interface ChatErrorAction {
  /** Button label; defaults to the localized "Retry". */
  text?: string;
  /** Runs instead of the built-in retry when provided. */
  onClick?: () => void;
}

/** Context for the tool call whose result is passed to {@link WidgetConfig.onToolCallApproveResult}. */
export interface ToolCallApproveContext {
  toolName: string;
  toolArgs: Record<string, unknown>;
  callId?: string;
  threadId?: string;
}

const WidgetConfigContext = createContext<WidgetConfig>({});

export interface WidgetConfigProviderProps {
  config?: WidgetConfig;
  children: React.ReactNode;
}

export const WidgetConfigProvider = ({
  config,
  children,
}: WidgetConfigProviderProps) => {
  const value = useMemo<WidgetConfig>(() => config ?? {}, [config]);

  // Apply the log level synchronously during render (module-global side
  // effect, same pattern the stores use for their global holders) so it takes
  // effect before children emit anything on first paint. Only when explicitly
  // set — otherwise a host-side `setLogLevel` call is left intact.
  if (value.logLevel) setLogLevel(value.logLevel);

  // Same synchronous-during-render treatment for the debug-export switch:
  // the export serializers are module-level and must already agree with the
  // config before any action bar can fire.
  if (value.debugExport !== undefined) setVerboseExport(value.debugExport);

  return (
    <WidgetConfigContext.Provider value={value}>
      {children}
    </WidgetConfigContext.Provider>
  );
};

export const useWidgetConfig = (): WidgetConfig => {
  return useContext(WidgetConfigContext);
};
