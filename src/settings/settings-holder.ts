import type { SettingsAdapter } from "./types";

/**
 * @internal
 * Global settings instance holder — legacy singleton bridge.
 * Used only by `AIChatWidget` for backward compatibility.
 * Headless consumers should use `AppContext.settings` instead.
 */
let settingsInstance: SettingsAdapter | null = null;

export function setSettingsInstance(settings: SettingsAdapter): void {
  settingsInstance = settings;
}

export function getSettingsInstance(): SettingsAdapter {
  if (!settingsInstance) {
    throw new Error(
      "Settings not initialized. Call setSettingsInstance() first."
    );
  }
  return settingsInstance;
}
