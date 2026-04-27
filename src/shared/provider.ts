import type { ProviderType } from "./provider-type";

/**
 * Minimal provider connection configuration. Used to connect to a provider API.
 *
 * @example
 * ```ts
 * const provider: TProvider = {
 *   type: "openai",
 *   name: "My OpenAI",
 *   baseUrl: "https://api.openai.com/v1",
 *   key: "sk-...",
 * };
 * ```
 */
export type TProvider = {
  /** Provider type identifier. */
  type: ProviderType;

  /** User-defined display name for this provider connection. */
  name: string;

  /** API key or token. Optional for local providers (Ollama, LM Studio). */
  key?: string;

  /** Base URL of the provider API. */
  baseUrl: string;
};
