/**
 * Web-search provider configuration. Credentials and provider selection
 * for the built-in web-search tool group.
 */
export type WebSearchConfig = {
  /** Provider identifier (e.g. `"exa"`). */
  provider: string;

  /** API key for the provider. Optional for self-hosted or keyless setups. */
  key?: string;

  /** Optional override for the provider's base URL. */
  baseUrl?: string;

  /** Whether this provider is cloud-hosted (vs. self-hosted). */
  isCloudProvider?: boolean;

  /**
   * Extra HTTP headers sent with each request to the ONLYOFFICE /
   * cloud backend (e.g. `X-Tenant`). Merged after the derived
   * `Authorization` header, so a custom header of the same name wins.
   */
  headers?: Record<string, string>;
};

/**
 * Storage interface for the singleton web-search configuration. The widget
 * supports at most one active web-search provider at a time, so `create`
 * refuses to overwrite an existing record — use `update` for that.
 */
export interface WebSearchStorage {
  /**
   * Save a web-search configuration for the first time in the requested
   * scope. Throws if one already exists in that scope.
   *
   * `entityId` is opaque — when provided the implementation should scope
   * the singleton to that entity ("room"); when omitted the unscoped
   * (global) singleton is used.
   */
  create(config: WebSearchConfig, entityId?: string): Promise<void>;

  /**
   * Read the active web-search configuration in the requested scope.
   * Returns `null` when not configured for that scope.
   */
  read(entityId?: string): Promise<WebSearchConfig | null>;

  /**
   * Replace the existing web-search configuration in the requested
   * scope. Throws if none exists in that scope.
   */
  update(config: WebSearchConfig, entityId?: string): Promise<void>;

  /**
   * Idempotent write — `create` if no configuration has been persisted
   * yet in the requested scope, `update` otherwise.
   */
  upsert(config: WebSearchConfig, entityId?: string): Promise<void>;

  /** Remove the stored configuration in the requested scope. */
  delete(entityId?: string): Promise<void>;
}
