import { createContext, useContext, useMemo } from "react";

export interface WidgetConfig {
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
