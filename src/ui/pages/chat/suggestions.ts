/**
 * A clickable prompt suggestion shown above the composer in a new
 * (empty) chat. Configured by the integrator and passed into the widget;
 * clicking one inserts its `prompt` into the composer input.
 */
export interface Suggestion {
  /** Short label shown on the chip. */
  name: string;
  /** Text inserted into the composer when the chip is clicked. */
  prompt: string;
}

/** Maximum number of suggestions rendered; extras are ignored. */
export const MAX_SUGGESTIONS = 20;
