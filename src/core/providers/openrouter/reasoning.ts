import {
  DEFAULT_REASONING_LEVEL,
  effectiveReasoningLevel,
  FULL_REASONING_SUPPORT,
  NO_REASONING_SUPPORT,
  REASONING_DEPTHS,
  reasoningSupport,
  type ReasoningDepth,
  type ReasoningLevel,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";
import logger from "../../../shared/logger";
import { isAlwaysThinking } from "../anthropic/reasoning";
import { extractErrorMessage, getErrorStatus } from "../errors";

/**
 * What one OpenRouter route can do with the unified `reasoning.effort`,
 * by upstream prefix. OpenRouter translates the effort to each upstream's
 * knob and clamps itself — `none` becomes Anthropic's `thinking: disabled`,
 * as observed on Sonnet 5 (the docs' "none is rejected" line describes
 * Anthropic's own effort scale, not the unified one) — so most routes take
 * the full scale. The exceptions:
 *
 * - `anthropic/claude-fable*` / `claude-mythos*` and `claude-opus-5.5`+
 *   think always; the disabled switch they would receive is a 400 upstream.
 * - `google/*` maps `xhigh` down to `high`, so `max` is not a distinct
 *   depth.
 * - `x-ai/*` cannot be disabled upstream.
 *
 * Whether an unknown route thinks at all is not knowable from the id;
 * OpenRouter's model list flags it (`Model.reasoning`), and the UI reads
 * that flag alongside this table.
 */
export function getOpenRouterReasoningSupport(model: string): ReasoningSupport {
  const id = model.toLowerCase();
  if (id.startsWith("anthropic/")) {
    return reasoningSupport(REASONING_DEPTHS, {
      canDisable: !isAlwaysThinking(id),
    });
  }
  if (id.startsWith("google/")) {
    return reasoningSupport(["low", "medium", "high"], { canDisable: true });
  }
  if (id.startsWith("x-ai/")) {
    return reasoningSupport(REASONING_DEPTHS, { canDisable: false });
  }
  return FULL_REASONING_SUPPORT;
}

/**
 * The per-model `reasoning` object in OpenRouter's `/models` catalogue (the
 * ONLYOFFICE route proxies it one-to-one). `null` on models without
 * thinking; `supported_efforts` is present on about half of the thinking
 * models, the rest state only `mandatory`.
 */
export type OpenRouterReasoningMeta = {
  mandatory?: boolean;
  default_enabled?: boolean;
  supported_efforts?: string[];
  default_effort?: string;
};

/** OpenRouter's effort vocabulary → our depth; `none` / unknown → nothing. */
const EFFORT_TO_DEPTH: Record<string, ReasoningDepth | undefined> = {
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "max",
  max: "max",
};

/**
 * Turn a catalogue entry's `reasoning` object into {@link ReasoningSupport}.
 *
 * - Missing field (`undefined`) → `undefined`: the catalogue said nothing,
 *   keep the id-based table.
 * - `null` → the model does not think.
 * - `mandatory` decides the off switch: OpenRouter answers a request with
 *   `effort: "none"` on a mandatory model with a 400 ("Reasoning is
 *   mandatory for this endpoint"), and turns it into the upstream's off
 *   switch everywhere else (Claude's `thinking: disabled` included).
 * - `supported_efforts` gives the depths (`minimal` folds into `low`,
 *   `xhigh` / `max` into `max`); without it the id-based table's depths
 *   stand in.
 * - `default_effort` becomes `defaultDepth`, what a stored off means on a
 *   mandatory model.
 */
export function reasoningSupportFromCatalog(
  meta: OpenRouterReasoningMeta | null | undefined,
  model: string
): ReasoningSupport | undefined {
  if (meta === undefined) return undefined;
  if (meta === null || typeof meta !== "object") return NO_REASONING_SUPPORT;
  const fromTable = getOpenRouterReasoningSupport(model);
  const listed = (meta.supported_efforts ?? [])
    .map((e) => EFFORT_TO_DEPTH[e])
    .filter((d): d is ReasoningDepth => d !== undefined);
  const depths = listed.length
    ? REASONING_DEPTHS.filter((d) => listed.includes(d))
    : fromTable.depths;
  const canDisable =
    meta.mandatory === true
      ? false
      : meta.mandatory === false || fromTable.canDisable;
  const defaultDepth = meta.default_effort
    ? EFFORT_TO_DEPTH[meta.default_effort]
    : undefined;
  return reasoningSupport(depths, { canDisable, defaultDepth });
}

/**
 * OpenRouter's unified `reasoning` object for one round: the clamped
 * level, `max` → `"xhigh"`, `off` → `"none"` (reasoning disabled).
 *
 * Routes that cannot be switched off (Grok, Claude Fable / Mythos) have no
 * switch in the composer; a stored off means the standard depth,
 * `effort: "medium"`.
 */
export function openRouterReasoningFields(
  model: string,
  level: ReasoningLevel,
  support: ReasoningSupport = getOpenRouterReasoningSupport(model)
): Record<string, unknown> {
  const effective = effectiveReasoningLevel(level, support);
  if (effective === "off") return { reasoning: { effort: "none" } };
  return { reasoning: { effort: effective === "max" ? "xhigh" : effective } };
}

/**
 * OpenRouter's answer to `effort: "none"` on a route whose upstream cannot
 * stop thinking: HTTP 400, "Reasoning is mandatory for this endpoint and
 * cannot be disabled." The catalogue's `mandatory` flag is supposed to say
 * so up front, but it is a per-model verdict and it lies for some routes —
 * DeepSeek V4 reports `mandatory: false` and rejects `none` all the same —
 * so the flag cannot be the only guard.
 */
export function isMandatoryReasoningError(error: unknown): boolean {
  return (
    getErrorStatus(error) === 400 &&
    /reasoning is mandatory/i.test(extractErrorMessage(error) ?? "")
  );
}

/**
 * The depth to reason at when a route turns out to be mandatory after all:
 * what a stored off means on a model that cannot stop — the catalogue's
 * default depth, else the standard depth clamped to the model — exactly what
 * the composer would have shown had the catalogue told the truth.
 */
export function mandatoryReasoningLevel(
  model: string,
  support: ReasoningSupport = getOpenRouterReasoningSupport(model)
): ReasoningDepth {
  const forced = effectiveReasoningLevel("off", {
    ...support,
    canDisable: false,
    depths: support.depths.length ? support.depths : REASONING_DEPTHS,
  });
  return forced === "off" ? DEFAULT_REASONING_LEVEL : forced;
}

/**
 * Run one OpenRouter request, and when it was sent with reasoning off and
 * the route answers that reasoning is mandatory, run it once more at
 * {@link mandatoryReasoningLevel}. Any other failure, and a failure of the
 * retry itself, propagates unchanged. The composer keeps showing Off for
 * the round — the catalogue gave it no reason to hide the switch — but the
 * round completes instead of surfacing the 400.
 */
export async function retryWhenReasoningMandatory<T>(
  params: { model: string; level: ReasoningLevel; support: ReasoningSupport },
  run: (level: ReasoningLevel) => Promise<T>
): Promise<T> {
  try {
    return await run(params.level);
  } catch (error) {
    if (params.level !== "off" || !isMandatoryReasoningError(error)) {
      throw error;
    }
    const fallback = mandatoryReasoningLevel(params.model, params.support);
    logger.warn(
      `OpenRouter route ${params.model} rejects reasoning off although its catalogue entry allows it; retrying at ${fallback}`
    );
    return run(fallback);
  }
}
