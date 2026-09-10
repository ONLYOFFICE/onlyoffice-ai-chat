/**
 * OpenRouter's routing preferences, after its latency-and-performance
 * guide (`/docs/guides/best-practices/latency-and-performance`).
 *
 * - `preferred_max_latency` bounds time-to-first-token: endpoints whose
 *   p90 TTFT over the rolling 5-minute window stays under the threshold
 *   are promoted to the front of the candidate list. The others are not
 *   dropped, so a model with one slow endpoint still answers.
 * - `sort.by: "throughput"` orders what is left by measured tokens per
 *   second instead of OpenRouter's price-first default.
 *
 * A hard-coded `provider.order` is deliberately absent: it switches off
 * OpenRouter's load balancing, which the guide advises against.
 */
export const OPENROUTER_PROVIDER_PREFERENCES = {
  preferred_max_latency: { p90: 2.5 },
  sort: { by: "throughput" },
} as const;

/**
 * Body fields OpenRouter reads on every chat-completions request:
 * {@link OPENROUTER_PROVIDER_PREFERENCES} under `provider`, and the
 * conversation id as `session_id` when the host supplied one.
 *
 * `session_id` gives OpenRouter a sticky-routing key: for about ten
 * minutes (best effort) the turns of one thread are pinned to the
 * endpoint that already holds the warm KV cache, so an agent loop does
 * not pay the prompt-prefix cost again on every tool round.
 *
 * @param sessionId - The thread id ({@link ProviderCredentials.sessionId}).
 * @returns Fields to spread into the request body.
 */
export function openRouterRoutingFields(
  sessionId?: string
): Record<string, unknown> {
  return {
    ...(sessionId ? { session_id: sessionId } : {}),
    provider: OPENROUTER_PROVIDER_PREFERENCES,
  };
}
