import {
  NO_REASONING_SUPPORT,
  REASONING_DEPTHS,
  reasoningSupport,
  type ReasoningSupport,
} from "../../../shared/reasoning-level";

/**
 * Parse `claude-<family>-<major>[-<minor>]` into a numeric generation.
 * `claude-sonnet-4-5-20250929` → 4.5, `claude-opus-5` → 5, ids in the
 * older `claude-3-5-sonnet` shape → `undefined`.
 */
export function parseClaudeModel(
  model: string
): { family: string; version: number } | undefined {
  const m = /claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d))?/i.exec(
    model
  );
  if (!m) return undefined;
  const version = Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
  return { family: m[1].toLowerCase(), version };
}

/** Fable / Mythos think always and reject both `enabled` and `disabled`. */
export function isAlwaysThinking(model: string): boolean {
  const family = parseClaudeModel(model)?.family;
  return family === "fable" || family === "mythos";
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
 * off, except Fable / Mythos, which think always. Claude 3.5 and older
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
