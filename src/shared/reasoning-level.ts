/**
 * Depth of extended thinking requested for one round.
 *
 * A provider-neutral scale; each provider maps it onto its own knob
 * (`reasoning_effort`, `thinking`, `thinkingLevel`, a model swap, …) and
 * clamps to the nearest level the model accepts — see
 * `core/providers/README.md`. `"off"` disables thinking where the model
 * allows it.
 */
export type ReasoningLevel = "off" | "low" | "medium" | "high" | "max";

/** Every {@link ReasoningLevel}, lowest first. */
export const REASONING_LEVELS: readonly ReasoningLevel[] = [
  "off",
  "low",
  "medium",
  "high",
  "max",
];

/** The depth the legacy boolean toggle stands for when it is on. */
export const DEFAULT_REASONING_LEVEL: Exclude<ReasoningLevel, "off"> = "medium";

/** Type guard for {@link ReasoningLevel}. */
export function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return (
    typeof value === "string" &&
    (REASONING_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Collapse the two ways a caller can ask for thinking into one level.
 *
 * `reasoningLevel` wins when present; otherwise the legacy `withReasoning`
 * boolean maps to {@link DEFAULT_REASONING_LEVEL} / `"off"`. Providers
 * call this first so every request path honours both fields.
 */
export function resolveReasoningLevel(args: {
  reasoningLevel?: ReasoningLevel;
  withReasoning?: boolean;
}): ReasoningLevel {
  if (args.reasoningLevel) return args.reasoningLevel;
  return args.withReasoning ? DEFAULT_REASONING_LEVEL : "off";
}

/** A {@link ReasoningLevel} above off — a depth the model can think at. */
export type ReasoningDepth = Exclude<ReasoningLevel, "off">;

/** Every {@link ReasoningDepth}, lowest first. */
export const REASONING_DEPTHS: readonly ReasoningDepth[] = [
  "low",
  "medium",
  "high",
  "max",
];

/**
 * What one model can do with extended thinking. Providers describe each
 * model through this shape so the UI offers only the choices that change
 * the request, and the request builders clamp to the same table.
 */
export type ReasoningSupport = {
  /** Whether the model can think at all. False hides the whole control. */
  thinks: boolean;
  /**
   * Whether `"off"` really turns thinking off. False means the model
   * thinks always and off only drops to its lowest depth (or leaves the
   * default depth, where there is no knob).
   */
  canDisable: boolean;
  /**
   * Depths the model distinguishes, lowest first. Empty when thinking is
   * an on/off switch with no depth (or the model doesn't think). A level
   * not listed is clamped to the nearest one — see
   * {@link clampReasoningLevel}.
   */
  depths: readonly ReasoningDepth[];
  /**
   * The depth the model runs at when nothing asks for one — what a stored
   * `"off"` means on a model that cannot be switched off. Known only where
   * a catalogue reports it (OpenRouter's `default_effort`); otherwise
   * {@link DEFAULT_REASONING_LEVEL} clamped to `depths` is assumed.
   */
  defaultDepth?: ReasoningDepth;
};

/** A model that thinks at every depth and can be switched off. */
export const FULL_REASONING_SUPPORT: ReasoningSupport = {
  thinks: true,
  canDisable: true,
  depths: REASONING_DEPTHS,
};

/** A model with no thinking at all. */
export const NO_REASONING_SUPPORT: ReasoningSupport = {
  thinks: false,
  canDisable: false,
  depths: [],
};

/**
 * Shorthand for a support record — `thinks` defaults to true, since a
 * model with depths or an off switch evidently thinks.
 */
export function reasoningSupport(
  depths: readonly ReasoningDepth[],
  opts: { canDisable: boolean; thinks?: boolean; defaultDepth?: ReasoningDepth }
): ReasoningSupport {
  return {
    thinks: opts.thinks ?? true,
    canDisable: opts.canDisable,
    depths,
    ...(opts.defaultDepth ? { defaultDepth: opts.defaultDepth } : {}),
  };
}

/**
 * The level a model actually runs at when asked for `level`.
 *
 * `"off"` stays off (whether or not the model honours it is
 * {@link ReasoningSupport.canDisable}'s business). A listed depth is
 * returned as-is; an unlisted one snaps to the nearest listed depth,
 * resolving ties upward — a Gemini 3 Pro asked for `medium` runs `high`,
 * a grok-3-mini asked for `medium` runs `high`, a gpt-5.1 asked for
 * `max` runs `high`. With no depths at all the level is returned
 * unchanged: there is nothing to snap to, and the provider treats every
 * depth as plain "on".
 */
export function clampReasoningLevel(
  level: ReasoningLevel,
  support: ReasoningSupport
): ReasoningLevel {
  if (level === "off" || support.depths.length === 0) return level;
  if (support.depths.includes(level)) return level;
  const want = REASONING_DEPTHS.indexOf(level);
  let best: ReasoningDepth = support.depths[0];
  let bestDistance = Infinity;
  for (const depth of support.depths) {
    const distance = Math.abs(REASONING_DEPTHS.indexOf(depth) - want);
    // `<=` so a later (higher) depth wins a tie.
    if (distance <= bestDistance) {
      best = depth;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The level a request actually carries for `level` on this model: the
 * clamped depth, except that `"off"` on a model that cannot be switched
 * off has no meaning — the composer offers no switch there — and stands
 * for the model's default depth: the catalogue's `defaultDepth` when known,
 * otherwise {@link DEFAULT_REASONING_LEVEL} clamped to the model's depths,
 * exactly what the legacy boolean toggle meant when on.
 * That is also what the composer shows as the current value. A model with
 * no depth knob keeps `"off"` (there is nothing to send either way).
 */
export function effectiveReasoningLevel(
  level: ReasoningLevel,
  support: ReasoningSupport
): ReasoningLevel {
  const clamped = clampReasoningLevel(level, support);
  if (clamped === "off" && !support.canDisable && support.depths.length > 0) {
    return clampReasoningLevel(
      support.defaultDepth ?? DEFAULT_REASONING_LEVEL,
      support
    );
  }
  return clamped;
}
