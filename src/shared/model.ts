import type { ProviderType } from "./provider-type";
import type { ReasoningSupport } from "./reasoning-level";

/**
 * AI model metadata. Describes a single model available from a provider.
 *
 * @example
 * ```ts
 * const model: Model = {
 *   id: "claude-sonnet-4-20250514",
 *   name: "Claude Sonnet 4",
 *   provider: "anthropic",
 *   reasoning: true,
 *   capabilities: 0b0001_0011, // Chat | Vision
 * };
 * ```
 */
export type Model = {
  /** Model identifier as used by the provider API (e.g. `"gpt-4o"`, `"claude-sonnet-4-20250514"`). */
  id: string;

  /** Human-readable model name for display in the UI. */
  name: string;

  /** Provider that offers this model. */
  provider: ProviderType;

  /** Whether this model supports extended thinking / chain-of-thought reasoning. */
  reasoning?: boolean;

  /**
   * What the model can do with extended thinking, when the provider's
   * catalogue says so (OpenRouter and the ONLYOFFICE route report a
   * per-model `reasoning` object). Copied onto the profile at save time;
   * absent, the widget falls back to the provider's id-based table.
   */
  reasoningSupport?: ReasoningSupport;

  /**
   * Bitmask of model capabilities (Chat, Image, Vision, Tools, etc.).
   * Used to filter models per {@link ActionType}.
   */
  capabilities?: number;

  /**
   * Release date as a Unix timestamp in **seconds**, when the provider's
   * catalogue reports one (OpenAI-shaped `/models` responses and
   * OpenRouter carry `created`; Anthropic carries an ISO `created_at`).
   * The model picker sorts on it so the newest releases come first;
   * entries without it fall back to alphabetical order.
   */
  created?: number;
};
