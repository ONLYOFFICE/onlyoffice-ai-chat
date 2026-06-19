import { createContext, useContext, useMemo } from "react";
import type { SystemPromptOverride } from "./core/actions";
import type { AssistantAction } from "./ui/pages/chat/assistant-actions";
import type { ComposerAction } from "./ui/pages/chat/composer-actions";
import type { Suggestion } from "./ui/pages/chat/suggestions";
import type { ModelFormValues } from "./ui/components/model-config-cards/sub-components/ModelConfigForm";
import type { Profile } from "./types";

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
   * Fixed at mount; live switching is not supported.
   */
  entityId?: string;
  hideProfilePicker?: boolean;
  /**
   * Hide the settings (gear) button in the header. The settings page itself
   * remains reachable programmatically via the router store.
   */
  hideSettingsButton?: boolean;
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
   * Clickable prompt suggestions shown above the composer in a new
   * (empty) chat only. Each item is `{ name, prompt }`; clicking inserts
   * its `prompt` into the composer input. Capped at 20 — extras are
   * ignored.
   */
  suggestions?: Suggestion[];
  /**
   * Arbitrary content rendered at the very top of a new (empty) chat
   * (above the welcome screen, with a 12px top offset). Shown only when
   * {@link WidgetConfig.suggestions} are visible.
   */
  suggestionsHeader?: React.ReactNode;
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

  return (
    <WidgetConfigContext.Provider value={value}>
      {children}
    </WidgetConfigContext.Provider>
  );
};

export const useWidgetConfig = (): WidgetConfig => {
  return useContext(WidgetConfigContext);
};
