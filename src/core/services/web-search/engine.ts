import type { TErrorData } from "../../../shared/error-data";
import type { WebSearchConfig } from "../../storage";
import type {
  WebSearchEngineDeps,
  WebSearchMutationResult,
} from "./types";
import { testWebSearchConnection } from "./validation";

/**
 * Web-search persistence orchestrator. Wraps `storage.webSearch`
 * with the rules that plain singleton CRUD can't express:
 *
 * - **Live credential validation** before persist — a `configure`
 *   call only stores the config when the provider responds OK.
 * - **Atomic switch** between providers — old config is overwritten
 *   in one round-trip via `storage.webSearch.upsert`.
 * - **Standalone `testConnection`** for "Test" buttons that should
 *   not commit on success.
 *
 * Mirrors the shape of {@link ProfilesEngine} for AI provider
 * profiles. Persistence-only — the live runtime tool source still
 * lives in [`src/tools/sources/WebSearch.ts`](../../../tools/sources/WebSearch.ts).
 */
export class WebSearchEngine {
  private readonly deps: WebSearchEngineDeps;

  constructor(deps: WebSearchEngineDeps) {
    this.deps = deps;
  }

  /** Read the active configuration, or `null` if not configured. */
  async getActiveConfig(): Promise<WebSearchConfig | null> {
    return this.deps.storage.webSearch.read();
  }

  /** Convenience: is web search currently configured? */
  async isConfigured(): Promise<boolean> {
    return (await this.deps.storage.webSearch.read()) !== null;
  }

  /**
   * Validate `config` against the live backend without persisting.
   * Use for "Test" buttons in the settings form.
   */
  async testConnection(
    config: WebSearchConfig
  ): Promise<true | TErrorData> {
    return testWebSearchConnection(config);
  }

  /**
   * Validate + persist atomically. The new config is only stored when
   * `testConnection` returns `true`. Replaces any previously stored
   * configuration in a single `storage.webSearch.upsert` call.
   */
  async configure(
    config: WebSearchConfig
  ): Promise<WebSearchMutationResult> {
    const result = await testWebSearchConnection(config);
    if (result !== true) return { success: false, error: result };

    await this.deps.storage.webSearch.upsert(config);
    return { success: true, config };
  }

  /**
   * Persist `config` directly without running `testConnection`. Use for
   * settings UIs that already validate the form locally and want to
   * save partial / mid-edit state without a network round-trip on every
   * keystroke.
   */
  async setActiveConfig(config: WebSearchConfig): Promise<void> {
    await this.deps.storage.webSearch.upsert(config);
  }

  /**
   * Remove the persisted configuration. No-op if web search was not
   * configured. Idempotent — safe to call from "Reset" UX.
   */
  async clear(): Promise<void> {
    if ((await this.deps.storage.webSearch.read()) !== null) {
      await this.deps.storage.webSearch.delete();
    }
  }
}
