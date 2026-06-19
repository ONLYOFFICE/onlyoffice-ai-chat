/**
 * Resolve the `reasoning_effort` value for an OpenAI-family request.
 *
 * - reasoning ON  → `"medium"` (the app's chosen effort).
 * - reasoning OFF → `"none"` for models that accept it (gpt-5.1 and newer,
 *   e.g. 5.1 / 5.2 / 5.5), so the model's own default reasoning (medium for
 *   the 5.5 family) is actually disabled instead of silently kept.
 *   Otherwise the field is omitted: gpt-5(.0) and the o-series bottom out at
 *   `"minimal"` / `"low"` (no `"none"`), "pro" variants can't go below
 *   `"medium"` at all, and non-reasoning models reject the parameter
 *   entirely — omitting preserves their prior behavior.
 */
export function resolveReasoningEffort(
  model: string,
  withReasoning?: boolean
): "medium" | "none" | undefined {
  if (withReasoning) return "medium";
  return supportsNoneReasoning(model) ? "none" : undefined;
}

/**
 * Whether the model accepts `reasoning_effort: "none"`. Introduced with
 * gpt-5.1, so any `gpt-5.<minor>` with `minor >= 1` (5.1, 5.2, 5.5, …)
 * qualifies; plain `gpt-5` and earlier reasoning families do not.
 *
 * "pro" variants (e.g. `gpt-5.5-pro`) are excluded: they don't allow any
 * reasoning effort below `"medium"`, so `"none"` would be rejected.
 */
export function supportsNoneReasoning(model: string): boolean {
  if (/\bpro\b|-pro/i.test(model)) return false;
  const match = /gpt-5\.(\d+)/.exec(model);
  return match ? Number(match[1]) >= 1 : false;
}
