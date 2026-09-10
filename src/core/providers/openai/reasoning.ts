import {
  clampReasoningLevel,
  effectiveReasoningLevel,
  NO_REASONING_SUPPORT,
  reasoningSupport,
  type ReasoningLevel,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/** Every value OpenAI's `reasoning_effort` accepts, across model families. */
export type OpenAIReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/** `gpt-5.5-pro`, `gpt-5-pro`, `o1-pro`, … — never below `"medium"`. */
function isProVariant(model: string): boolean {
  return /\bpro\b|-pro/i.test(model);
}

/** The gpt-6 family (`gpt-6`, `gpt-6-astra`, …). */
function isGpt6(model: string): boolean {
  return /gpt-6(?:[.-]|$)/i.test(model);
}

/** `gpt-5.<minor>` → minor, or `undefined` for anything else. */
function gpt5Minor(model: string): number | undefined {
  const match = /gpt-5\.(\d+)/.exec(model);
  return match ? Number(match[1]) : undefined;
}

/** `gpt-5`, `gpt-5-mini`, `gpt-5-codex`, … — the 5.0 generation. */
function isGpt5Zero(model: string): boolean {
  return /gpt-5(?![\d.])/i.test(model) && gpt5Minor(model) === undefined;
}

/** `o1`, `o3-mini`, `o4-mini-deep-research`, … */
function isOSeries(model: string): boolean {
  return /(?:^|\/)o[1-9](?:-|$)/i.test(model);
}

/**
 * OpenAI models that are known not to think at all; `reasoning_effort` is
 * rejected there ("Unsupported parameter"), so nothing may be sent.
 */
function isKnownNonReasoning(model: string): boolean {
  return /gpt-(?:3\.5|4(?![\d.])|4o|4\.1|4\.5)|chatgpt|dall-e|gpt-image|sora|tts|whisper|embedding|moderation|babbage|davinci/i.test(
    model
  );
}

/**
 * Whether the model accepts `reasoning_effort: "none"`. Introduced with
 * gpt-5.1, so any `gpt-5.<minor>` with `minor >= 1` (5.1, 5.2, 5.5, …)
 * qualifies; plain `gpt-5`, the gpt-6 family (which bottoms out at
 * `"minimal"`) and earlier reasoning families do not.
 *
 * "pro" variants (e.g. `gpt-5.5-pro`) are excluded: they don't allow any
 * reasoning effort below `"medium"`, so `"none"` would be rejected.
 */
export function supportsNoneReasoning(model: string): boolean {
  if (isProVariant(model)) return false;
  const minor = gpt5Minor(model);
  return minor !== undefined && minor >= 1;
}

/**
 * Whether the model accepts `reasoning_effort: "xhigh"`. Documented for
 * gpt-5.2 and newer, the gpt-6 family and the `codex-max` variants;
 * gpt-5.0 / 5.1 and the o-series top out at `"high"`.
 */
export function supportsXhighReasoning(model: string): boolean {
  if (/codex-max/i.test(model) || isGpt6(model)) return true;
  const minor = gpt5Minor(model);
  return minor !== undefined && minor >= 2;
}

/**
 * Whether the model accepts `reasoning_effort: "max"`, the level above
 * `"xhigh"`. Documented for gpt-5.5 and newer and the gpt-6 family.
 */
export function supportsMaxReasoning(model: string): boolean {
  if (isGpt6(model)) return true;
  const minor = gpt5Minor(model);
  return minor !== undefined && minor >= 5;
}

/**
 * What one OpenAI-family model can do with `reasoning_effort`, per
 * OpenAI's per-model tables:
 *
 * - The known non-reasoning families (gpt-4o, gpt-4.1, gpt-3.5, the media
 *   models, …) don't think and reject the parameter.
 * - gpt-5.0 and the o-series: `low` / `medium` / `high`, no `none` — they
 *   cannot be switched off.
 * - gpt-5.1: adds `none`, so off is real. gpt-5.2+ adds `xhigh` (our
 *   `max`), gpt-5.5+ adds `max` itself.
 * - gpt-6: `minimal` … `max` but no `none`, so it cannot be switched off.
 * - "pro" variants never go below `medium` and never disable.
 * - Anything else — the ids an OpenAI-compatible backend serves (Ollama,
 *   LM Studio, Together, …) — is assumed to think at `low` / `medium` /
 *   `high`; off omits the parameter, which for most local models means no
 *   reasoning and is what the request always sent there.
 */
export function getOpenAIReasoningSupport(model: string): ReasoningSupport {
  if (isKnownNonReasoning(model)) return NO_REASONING_SUPPORT;
  const pro = isProVariant(model);
  const base = pro
    ? (["medium", "high"] as const)
    : (["low", "medium", "high"] as const);
  const withMax = supportsXhighReasoning(model) || supportsMaxReasoning(model);
  const depths = withMax ? [...base, "max" as const] : [...base];
  if (isGpt6(model) || isOSeries(model) || isGpt5Zero(model)) {
    return reasoningSupport(depths, { canDisable: false });
  }
  if (gpt5Minor(model) !== undefined) {
    return reasoningSupport(depths, { canDisable: !pro });
  }
  return reasoningSupport(["low", "medium", "high"], { canDisable: true });
}

/**
 * Resolve the `reasoning_effort` value for an OpenAI-family request. The
 * level is first clamped to what {@link getOpenAIReasoningSupport} lists
 * for the model, so a value the API would reject with a 400 is never sent:
 *
 * - `low` / `medium` / `high` go through as-is.
 * - `max` → `"max"` where documented (gpt-5.5+, gpt-6), `"xhigh"` on
 *   gpt-5.2 – 5.4 and the codex-max variants, `"high"` everywhere else.
 * - `off` → `"none"` where the model accepts it (gpt-5.1+, non-pro), so
 *   the model's own default reasoning (medium for the 5.5 family) is
 *   actually disabled instead of silently kept. Models that cannot stop
 *   (gpt-5.0, gpt-6, the o-series, the pro variants) have no switch in the
 *   composer, and a stored off means the standard depth, `"medium"`.
 *   Unknown ids on OpenAI-compatible backends omit the field, as before.
 * - Models that don't think get no field at all.
 */
export function resolveReasoningEffort(
  model: string,
  level: ReasoningLevel
): OpenAIReasoningEffort | undefined {
  const support = getOpenAIReasoningSupport(model);
  if (!support.thinks) return undefined;
  if (support.canDisable && clampReasoningLevel(level, support) === "off") {
    return supportsNoneReasoning(model) ? "none" : undefined;
  }
  const effective = effectiveReasoningLevel(level, support);
  if (effective === "off") return undefined;
  if (effective === "max") {
    return supportsMaxReasoning(model) ? "max" : "xhigh";
  }
  return effective;
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
 * @param level - Extended-thinking depth for this round.
 * @param opts.summary - Ask for the reasoning summary. Off by default:
 *   one-shot callers read only the final text, so the extra summary
 *   tokens would be paid for and thrown away.
 * @returns The `reasoning` object, or `undefined` to omit the field.
 */
export function resolveReasoningParam(
  model: string,
  level: ReasoningLevel,
  opts?: { summary?: boolean }
): { effort: OpenAIReasoningEffort; summary?: "auto" } | undefined {
  const effort = resolveReasoningEffort(model, level);
  if (!effort) return undefined;
  return level !== "off" && opts?.summary
    ? { effort, summary: "auto" }
    : { effort };
}
