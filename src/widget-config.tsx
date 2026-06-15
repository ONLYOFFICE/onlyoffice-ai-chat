import { createContext, useContext, useMemo } from "react";
import type { SystemPromptOverride } from "./core/actions";
import type { AssistantAction } from "./ui/pages/chat/assistant-actions";
import type { ComposerAction } from "./ui/pages/chat/composer-actions";
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
   * When set, the host can only approve/deny a single call at a time and
   * cannot opt into persisting the allow decision for the tool.
   */
  hideToolAllowAlways?: boolean;
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
   */
  onToolCallApproveResult?: (result: unknown) => void | Promise<void>;
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
