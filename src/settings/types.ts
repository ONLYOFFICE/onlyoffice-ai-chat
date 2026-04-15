/**
 * Pluggable key-value settings adapter.
 *
 * Host applications provide their own implementation (e.g. localStorage,
 * AsyncStorage, etc.). The library accesses settings **only** through this
 * interface, so swapping the backing store requires no changes to the rest
 * of the codebase.
 *
 * Every method is synchronous — if the host storage is async, the adapter
 * should pre-load values during initialization and serve them from an
 * in-memory cache.
 *
 * @example
 * ```ts
 * import type { SettingsAdapter } from "@onlyoffice/ai-chat";
 *
 * const localStorageAdapter: SettingsAdapter = {
 *   get(key: string): string | null {
 *     return localStorage.getItem(key);
 *   },
 *   set(key: string, value: string): void {
 *     localStorage.setItem(key, value);
 *   },
 *   remove(key: string): void {
 *     localStorage.removeItem(key);
 *   },
 * };
 * ```
 */
export interface SettingsAdapter {
  /** Read a value by key. Returns null if key does not exist */
  get(key: string): string | null;

  /** Write a value by key */
  set(key: string, value: string): void;

  /** Remove a key and its value */
  remove(key: string): void;
}
