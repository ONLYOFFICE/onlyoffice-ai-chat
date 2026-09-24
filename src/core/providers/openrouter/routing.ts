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
 * Whether an OpenRouter route returns pictures from `/chat/completions`.
 *
 * OpenRouter has no images endpoint: an image-output model answers a
 * normal chat request with `message.images[*]`, but only when the request
 * asked for the image modality. The per-model catalogue says so in
 * `architecture.output_modalities`, but a provider instance holds only
 * credentials and a model id at request time — so the id is the signal,
 * and every image route to date carries `image` in its slug
 * (`google/gemini-3-pro-image`, `openai/gpt-4o-image`, `gpt-5-image`).
 *
 * The check is deliberately narrow: `modalities` on a text-only route is
 * a 400 from some upstreams, so it is sent only where it is needed.
 *
 * @param model - OpenRouter route id, e.g. `google/gemini-3-pro-image`.
 * @returns `true` when the route can emit inline images.
 */
export function isImageOutputModel(model: string): boolean {
  return model.toLowerCase().includes("image");
}

/**
 * The `modalities` field for one route: present only on image-output
 * routes, where it is what makes OpenRouter return the picture at all.
 *
 * @param model - OpenRouter route id.
 * @returns Fields to spread into the request body.
 * @see isImageOutputModel
 */
export function openRouterModalityFields(
  model: string
): Record<string, unknown> {
  return isImageOutputModel(model)
    ? { modalities: ["image", "text"] }
    : {};
}

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
