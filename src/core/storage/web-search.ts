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
};

/**
 * Storage interface for the singleton web-search configuration. The widget
 * supports at most one active web-search provider at a time, so `create`
 * refuses to overwrite an existing record — use `update` for that.
 */
export interface WebSearchStorage {
  /**
   * Save a web-search configuration for the first time. Throws if a
   * configuration already exists.
   *
   * @param config - The configuration to persist.
   */
  create(config: WebSearchConfig): Promise<void>;

  /**
   * Read the active web-search configuration.
   *
   * @returns The stored configuration, or `null` if web-search is not set up.
   */
  read(): Promise<WebSearchConfig | null>;

  /**
   * Replace the existing web-search configuration. Throws if none exists.
   *
   * @param config - The replacement configuration.
   */
  update(config: WebSearchConfig): Promise<void>;

  /**
   * Idempotent write — `create` if no configuration has been persisted
   * yet, `update` otherwise. Lets callers replace the singleton config
   * without first checking whether the row exists.
   */
  upsert(config: WebSearchConfig): Promise<void>;

  /**
   * Remove the stored configuration. Subsequent `read()` calls return `null`.
   */
  delete(): Promise<void>;
}
