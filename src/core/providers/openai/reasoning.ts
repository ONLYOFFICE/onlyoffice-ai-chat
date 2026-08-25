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
 * Build the Responses API `reasoning` object.
 *
 * The effort comes from {@link resolveReasoningEffort}; `summary` is what
 * makes the thinking transcript observable at all — the Responses API
 * emits `response.reasoning_summary_text.delta` events (the only reasoning
 * text a caller ever sees there) *only* when the request asks for a
 * summary. Without it the model still reasons, but silently, and the
 * chat's thinking block has nothing to render.
 *
 * `summary` is requested only when the user turned extended thinking on:
 * with it off, models that ignore `"none"` (gpt-5.0, the o-series) still
 * reason internally, and an unconditional summary would surface a
 * thinking block the user explicitly switched off.
 *
 * @param model - Target model id.
 * @param withReasoning - Whether extended thinking is on for this round.
 * @param opts.summary - Ask for the reasoning summary. Off by default:
 *   one-shot callers read only the final text, so the extra summary
 *   tokens would be paid for and thrown away.
 * @returns The `reasoning` object, or `undefined` to omit the field.
 */
export function resolveReasoningParam(
  model: string,
  withReasoning?: boolean,
  opts?: { summary?: boolean }
): { effort: "medium" | "none"; summary?: "auto" } | undefined {
  const effort = resolveReasoningEffort(model, withReasoning);
  if (!effort) return undefined;
  return withReasoning && opts?.summary
    ? { effort, summary: "auto" }
    : { effort };
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
