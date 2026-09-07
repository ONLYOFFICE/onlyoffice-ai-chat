import type Anthropic from "@anthropic-ai/sdk";

/**
 * Output cap for a thinking turn. Thinking consumes `max_tokens` (a manual
 * budget is carved out of it), so a thinking request needs MORE headroom
 * than a plain one — not less. 32000 is the smallest max-output limit
 * among thinking-capable Claude models (Opus 4/4.1); the Sonnet and Haiku
 * 4.x families allow 64k, so this value is safe everywhere while leaving
 * 22k tokens for the visible reply above the manual budget.
 */
export const THINKING_MAX_TOKENS = 32000;
/** Manual (`type: "enabled"`) thinking budget for pre-4.6 models. */
export const THINKING_BUDGET_TOKENS = 10000;

type ThinkingParam =
  | { type: "adaptive" }
  | { type: "disabled" }
  | { type: "enabled"; budget_tokens: number };

/**
 * The installed SDK predates adaptive thinking, so its `ThinkingConfigParam`
 * has no `"adaptive"` member; the request body is sent verbatim either way.
 */
type ThinkingField = { thinking?: Anthropic.Messages.ThinkingConfigParam };

const field = (thinking: ThinkingParam): ThinkingField => ({
  thinking: thinking as unknown as Anthropic.Messages.ThinkingConfigParam,
});

/**
 * Parse `claude-<family>-<major>[-<minor>]` into a numeric generation.
 * `claude-sonnet-4-5-20250929` → 4.5, `claude-opus-5` → 5, ids in the
 * older `claude-3-5-sonnet` shape (no thinking at all) → `undefined`.
 */
function parseModel(
  model: string
): { family: string; version: number } | undefined {
  const m = /claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d))?/i.exec(
    model
  );
  if (!m) return undefined;
  const version = Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
  return { family: m[1].toLowerCase(), version };
}

/**
 * The `thinking` request field for one round, per Anthropic's per-model
 * table.
 *
 * - **Fable / Mythos** think always and reject both `"enabled"` and
 *   `"disabled"`: on sends `adaptive` (accepted), off omits the field.
 * - **4.6 and newer** (Opus 4.6+, Sonnet 4.6+, Opus 5, Sonnet 5) run
 *   adaptive thinking; `"enabled"` + `budget_tokens` is deprecated on 4.6
 *   and a 400 from 4.7 on. Off is sent explicitly as `"disabled"`: Opus 5
 *   and Sonnet 5 think *by default*, so omitting the field would leave
 *   them reasoning with the toggle off.
 * - **4.5 and earlier** know only manual extended thinking: on sends
 *   `"enabled"` with a budget, off omits the field (their default is off
 *   and they don't accept `"disabled"`).
 *
 * Ids that don't parse (proxies, aliases) get the manual mapping — the
 * behaviour the provider always had.
 */
export function resolveThinkingParam(
  model: string,
  withReasoning?: boolean
): ThinkingField {
  const parsed = parseModel(model);
  const alwaysOn = parsed?.family === "fable" || parsed?.family === "mythos";
  const adaptive = alwaysOn || (parsed !== undefined && parsed.version >= 4.6);

  if (withReasoning) {
    return adaptive
      ? field({ type: "adaptive" })
      : field({ type: "enabled", budget_tokens: THINKING_BUDGET_TOKENS });
  }
  if (adaptive && !alwaysOn) return field({ type: "disabled" });
  return {};
}
