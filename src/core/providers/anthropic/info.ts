export const anthropicInfo = {
  name: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  /**
   * Id fragments of thinking-capable models. Every Claude from the 4.5
   * generation on can think (Fable and Mythos always do); see
   * `thinking.ts` for how the request is spelled per generation.
   */
  thinkingModels: [
    "claude-sonnet-4-5",
    "claude-opus-4-5",
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-6",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-opus-5",
    "claude-fable",
    "claude-mythos",
  ],
};
