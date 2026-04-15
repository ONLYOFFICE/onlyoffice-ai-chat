import type Servers from "./servers";

/**
 * @internal
 * Global Servers instance holder — legacy singleton bridge.
 * Used only by `AIChatWidget` for backward compatibility.
 * Headless consumers should use `AppContext.servers` instead.
 */
let serversInstance: Servers | null = null;

export function setServersInstance(servers: Servers): void {
  serversInstance = servers;
}

export function getServersInstance(): Servers {
  if (!serversInstance) {
    throw new Error(
      "Servers not initialized. Wrap your app in <ToolsProvider>."
    );
  }
  return serversInstance;
}
