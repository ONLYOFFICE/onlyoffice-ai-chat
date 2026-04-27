/**
 * Union of all 16 built-in AI provider type identifiers.
 *
 * @see {@link ProviderType} for the full type that also accepts custom strings.
 */
export type BuiltinProviderType =
  | "anthropic"
  | "ollama"
  | "openai"
  | "openaicompatible"
  | "together"
  | "openrouter"
  | "genai"
  | "deepseek"
  | "xai"
  | "lm-studio"
  | "mistral"
  | "groq"
  | "zhipu"
  | "stabilityai"
  | "gpt4all"
  | "onlyoffice";
