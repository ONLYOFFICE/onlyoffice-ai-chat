import type Provider from "./index";

/**
 * @internal
 * Global Provider instance holder — legacy singleton bridge.
 * Used only by `AIChatWidget` for backward compatibility.
 * Headless consumers should use `AppContext.provider` instead.
 */
let providerInstance: InstanceType<typeof Provider> | null = null;

export function setProviderInstance(p: InstanceType<typeof Provider>): void {
  providerInstance = p;
}

export function getProviderInstance(): InstanceType<typeof Provider> {
  if (!providerInstance) {
    throw new Error("Provider not initialized.");
  }
  return providerInstance;
}
