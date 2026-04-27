import type { SystemPromptOverride } from "./types";

/**
 * Resolve the final system prompt for an action with a baked-in default.
 *
 * - No override: return `defaultPrompt`.
 * - `replace`: return the override text verbatim.
 * - `append`: return the default followed by a blank line and the
 *   override text.
 */
export function resolveSystemPrompt(
  defaultPrompt: string,
  override: SystemPromptOverride | undefined
): string {
  if (!override) return defaultPrompt;
  if (override.mode === "replace") return override.text;
  return `${defaultPrompt}\n\n${override.text}`;
}
