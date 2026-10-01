import type Anthropic from "@anthropic-ai/sdk";
import {
  effectiveReasoningLevel,
  type ReasoningLevel,
} from "../../../shared/reasoning-level";
import type { ReasoningSupport } from "../../../shared/reasoning-level";
import { extractErrorMessage, getErrorStatus } from "../errors";
import {
  getAnthropicReasoningSupport,
  isAdaptiveThinking,
  isAlwaysThinking,
  isBetweenToolsOff,
} from "./reasoning";

/**
 * Output cap for a thinking turn. Thinking consumes `max_tokens` (a manual
 * budget is carved out of it), so a thinking request needs MORE headroom
 * than a plain one — not less. 32000 is the smallest max-output limit
 * among thinking-capable Claude models (Opus 4/4.1); the Sonnet and Haiku
 * 4.x families allow 64k, so this value is safe everywhere while leaving
 * room for the visible reply above every manual budget below.
 */
export const THINKING_MAX_TOKENS = 32000;
/** Manual (`type: "enabled"`) thinking budget for pre-4.6 models, `medium`. */
export const THINKING_BUDGET_TOKENS = 10000;

/**
 * Manual `budget_tokens` per level for the models that still take one
 * (4.5 and earlier). `max` stays 4k under {@link THINKING_MAX_TOKENS} so
 * the reply is never squeezed out; Anthropic also requires the budget to be
 * strictly below `max_tokens`.
 */
const MANUAL_BUDGETS: Record<Exclude<ReasoningLevel, "off">, number> = {
  low: 4000,
  medium: THINKING_BUDGET_TOKENS,
  high: 20000,
  max: 28000,
};

type ThinkingParam =
  | { type: "adaptive" }
  | { type: "disabled" }
  | { type: "between_tools" }
  | { type: "enabled"; budget_tokens: number };

/** `output_config.effort` — the depth knob that goes with adaptive thinking. */
type Effort = "low" | "medium" | "high" | "max";

/**
 * The installed SDK predates adaptive thinking and `output_config`, so its
 * param types know neither; the request body is sent verbatim either way.
 */
type ThinkingField = {
  thinking?: Anthropic.Messages.ThinkingConfigParam;
  output_config?: { effort: Effort };
};

const field = (thinking: ThinkingParam, effort?: Effort): ThinkingField => ({
  thinking: thinking as unknown as Anthropic.Messages.ThinkingConfigParam,
  ...(effort ? { output_config: { effort } } : {}),
});

/**
 * Models that answered `thinking: disabled` with the 400 asking for
 * `between_tools` instead. Module-level because a provider instance is
 * short-lived, while the model's answer holds for the whole session.
 * Anthropic's per-model table lags the live API — Sonnet 5 took
 * `disabled` by the docs and rejected it in practice — so the spelling is
 * learned from the error, with {@link isBetweenToolsOff} as the known
 * starting point.
 */
const betweenToolsLearned = new Set<string>();

/** Send this model `between_tools` as its off from now on. */
export function rememberBetweenToolsOff(model: string): void {
  betweenToolsLearned.add(model);
}

/**
 * The 400 a model returns to `thinking: {type: "disabled"}` when its off
 * is spelled `between_tools` — the field, not the request, is the problem.
 */
export function isBetweenToolsRejection(error: unknown): boolean {
  return (
    getErrorStatus(error) === 400 &&
    (extractErrorMessage(error) ?? "").includes("between_tools")
  );
}

/** `true` when the fields carry the `disabled` switch a retry could respell. */
export function sendsDisabledThinking(fields: ThinkingField): boolean {
  return (fields.thinking as ThinkingParam | undefined)?.type === "disabled";
}

/**
 * The `thinking` (and `output_config`) request fields for one round, per
 * Anthropic's per-model table.
 *
 * - **Fable / Mythos and Opus 5.5+** think always and reject both
 *   `"enabled"` and `"disabled"`: any level sends `adaptive` (accepted) plus the matching
 *   `output_config.effort`; a stored off means the standard depth,
 *   `effort: "medium"` (the composer offers them no switch).
 * - **4.6 and newer** (Opus 4.6+, Sonnet 4.6+, Opus 5, Sonnet 5) run
 *   adaptive thinking, and the depth is `output_config.effort`
 *   (`low` … `max`, a 1:1 match with {@link ReasoningLevel}). `"enabled"`
 *   + `budget_tokens` is deprecated on 4.6 and a 400 from 4.7 on. Off is
 *   sent explicitly as `"disabled"`: Opus 5 and Sonnet 5 think *by
 *   default*, so omitting the field would leave them reasoning with the
 *   toggle off — except the models whose off is spelled
 *   `"between_tools"` (`"disabled"` is a 400 there): Sonnet 5.5+ by the
 *   docs, plus any model that has said so (the provider retries that 400
 *   once and calls {@link rememberBetweenToolsOff}). It takes no other
 *   field and no `output_config.effort` above `high`; off sends neither.
 * - **4.5 and earlier** know only manual extended thinking: the level
 *   picks a `budget_tokens` from {@link MANUAL_BUDGETS}; off omits the
 *   field (their default is off and they don't accept `"disabled"`).
 *
 * Ids that don't parse (proxies, aliases) get the manual mapping — the
 * behaviour the provider always had.
 */
export function resolveThinkingParam(
  model: string,
  level: ReasoningLevel,
  support: ReasoningSupport = getAnthropicReasoningSupport(model)
): ThinkingField {
  const alwaysOn = isAlwaysThinking(model);
  const adaptive = isAdaptiveThinking(model);
  const effective = effectiveReasoningLevel(level, support);

  if (effective !== "off") {
    return adaptive
      ? field({ type: "adaptive" }, effective)
      : field({ type: "enabled", budget_tokens: MANUAL_BUDGETS[effective] });
  }
  if (adaptive && !alwaysOn) {
    return field({
      type:
        isBetweenToolsOff(model) || betweenToolsLearned.has(model)
          ? "between_tools"
          : "disabled",
    });
  }
  return {};
}
