import type { StorageAdapter } from "./types";

/**
 * @internal
 * Global storage instance holder — legacy singleton bridge.
 * Used only by `AIChatWidget` for backward compatibility.
 * Headless consumers should use `AppContext.storage` instead.
 */
let storageInstance: StorageAdapter | null = null;

export function setStorageInstance(storage: StorageAdapter): void {
  storageInstance = storage;
}

export function getStorageInstance(): StorageAdapter {
  if (!storageInstance) {
    throw new Error(
      "Storage not initialized. Call setStorageInstance() first."
    );
  }
  return storageInstance;
}
