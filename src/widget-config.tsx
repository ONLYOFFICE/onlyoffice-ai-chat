import { createContext, useContext, useMemo } from "react";
import type { SystemPromptOverride } from "./core/actions";
import type { AssistantAction } from "./ui/pages/chat/assistant-actions";
import type { ComposerAction } from "./ui/pages/chat/composer-actions";

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
