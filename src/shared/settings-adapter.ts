/**
 * Minimal key/value settings interface used by the runtime tools layer
 * (`src/tools/`). Hosts back this with `localStorage`, an in-memory
 * map, or any other key/value store.
 *
 * Long-term, every persistent piece of UI state should migrate to a
 * dedicated `core/storage` slice; until then a small handful of
 * browser-only knobs (allow-always tool list, web-search provider
 * data) still live behind this adapter.
 */
export interface SettingsAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
