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

  /**
   * Read the active configuration in scope, or `null` if not configured.
   * `entityId` is opaque and forwarded to storage as-is.
   */
  async getActiveConfig(
    entityId?: string
  ): Promise<WebSearchConfig | null> {
    return this.deps.storage.webSearch.read(entityId);
  }

  /** Convenience: is web search currently configured in scope? */
  async isConfigured(entityId?: string): Promise<boolean> {
    return (await this.deps.storage.webSearch.read(entityId)) !== null;
  }

  /**
   * Validate `config` against the live backend without persisting.
   * Stateless w.r.t. storage — no `entityId` argument.
   */
  async testConnection(
    config: WebSearchConfig
  ): Promise<true | TErrorData> {
    return testWebSearchConnection(config);
  }

  /**
   * Validate + persist atomically in scope. The new config is only
   * stored when `testConnection` returns `true`.
   */
  async configure(
    config: WebSearchConfig,
    entityId?: string
  ): Promise<WebSearchMutationResult> {
    const result = await testWebSearchConnection(config);
    if (result !== true) return { success: false, error: result };

    await this.deps.storage.webSearch.upsert(config, entityId);
    return { success: true, config };
  }

  /**
   * Persist `config` directly without running `testConnection`. Use for
   * settings UIs that already validate the form locally.
   */
  async setActiveConfig(
    config: WebSearchConfig,
    entityId?: string
  ): Promise<void> {
    await this.deps.storage.webSearch.upsert(config, entityId);
  }

  /**
   * Remove the persisted configuration in scope. No-op if web search was
   * not configured for that scope.
   */
  async clear(entityId?: string): Promise<void> {
    if ((await this.deps.storage.webSearch.read(entityId)) !== null) {
      await this.deps.storage.webSearch.delete(entityId);
    }
  }
}
