import {
  NO_REASONING_SUPPORT,
  REASONING_DEPTHS,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * Parse `claude-<family>-<major>[-<minor>]` into a numeric generation.
 * `claude-sonnet-4-5-20250929` → 4.5, `claude-opus-5` → 5, ids in the
 * older `claude-3-5-sonnet` shape → `undefined`. The minor may also follow
 * a dot, the way OpenRouter spells the same ids (`anthropic/claude-opus-5.5`).
 */
export function parseClaudeModel(
  model: string
): { family: string; version: number } | undefined {
  const m =
    /claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:[-.](\d)(?!\d))?/i.exec(
      model
    );
  if (!m) return undefined;
  const version = Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
  return { family: m[1].toLowerCase(), version };
}

/**
 * Models that think always and reject both `enabled` and `disabled`:
 * Fable / Mythos, and Opus from 5.5 on — Opus 5.5 answers
 * `"thinking.type.disabled" is not supported for this model` with a 400 at
 * every effort level, `output_config.effort` being its only knob
 * (DocSpace bug 84082). Opus 5 still accepts `disabled`.
 */
export function isAlwaysThinking(model: string): boolean {
  const parsed = parseClaudeModel(model);
  if (!parsed) return false;
  if (parsed.family === "fable" || parsed.family === "mythos") return true;
  return parsed.family === "opus" && parsed.version >= 5.5;
}

/** 4.6 and newer run adaptive thinking with `output_config.effort`. */
export function isAdaptiveThinking(model: string): boolean {
  const parsed = parseClaudeModel(model);
  return (
    isAlwaysThinking(model) || (parsed !== undefined && parsed.version >= 4.6)
  );
}

/**
 * What one Claude model can do with extended thinking.
 *
 * Every Claude from 3.7 on thinks at all four depths — `output_config.effort`
 * (`low` … `max`) on 4.6+, a manual budget before — and can be switched
 * off, except Fable / Mythos and Opus 5.5+, which think always. Claude 3.5 and older
 * (and the 2.x / Instant ids) have no thinking at all. Ids that don't
 * parse (proxies, aliases) are treated like a 4.5: full depth, off works.
 */
export function getAnthropicReasoningSupport(model: string): ReasoningSupport {
  if (/claude-(?:2|instant|3-(?:5-|opus|haiku|sonnet))/i.test(model)) {
    return NO_REASONING_SUPPORT;
  }
  return reasoningSupport(REASONING_DEPTHS, {
    canDisable: !isAlwaysThinking(model),
  });
}
