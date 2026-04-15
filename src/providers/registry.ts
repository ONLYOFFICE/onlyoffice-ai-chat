import type { ProviderType } from "../types";
import { AnthropicProvider, anthropicProvider } from "./anthropic";
import { DeepSeekProvider, deepseekProvider } from "./deepseek";
import { GenAIProvider, genaiProvider } from "./genai";
import { GPT4AllProvider, gpt4allProvider } from "./gpt4all";
import { GroqProvider, groqProvider } from "./groq";
import { LMStudioProvider, lmStudioProvider } from "./lm-studio";
import { MistralProvider, mistralProvider } from "./mistral";
import { OllamaProvider, ollamaProvider } from "./ollama";
import { OnlyOfficeProvider, onlyOfficeProvider } from "./onlyoffice";
import { OpenAIProvider, openaiProvider } from "./openai";
import {
  OpenAICompatibleProvider,
  openaicompatibleProvider,
} from "./openaicompatible";
import { OpenRouterProvider, openrouterProvider } from "./openrouter";
import { StabilityAIProvider, stabilityaiProvider } from "./stabilityai";
import { TogetherProvider, togetherProvider } from "./together";
import { XAIProvider, xaiProvider } from "./xai";
import { ZhipuProvider, zhipuProvider } from "./zhipu";

/**
 * Union of all 16 built-in provider class instances shipped with the library.
 * Use this type when you need to accept any built-in provider but not
 * arbitrary custom ones.
 */
export type BuiltinProvider =
  | AnthropicProvider
  | OllamaProvider
  | OpenAIProvider
  | OpenAICompatibleProvider
  | TogetherProvider
  | OpenRouterProvider
  | GenAIProvider
  | DeepSeekProvider
  | XAIProvider
  | LMStudioProvider
  | MistralProvider
  | GroqProvider
  | ZhipuProvider
  | StabilityAIProvider
  | GPT4AllProvider
  | OnlyOfficeProvider;

/**
 * Union type representing any provider instance the library can work with.
 * Includes all {@link BuiltinProvider} types as well as any custom provider
 * that extends {@link import("./base").AbstractBaseProvider}.
 */
export type BaseProvider =
  | BuiltinProvider
  | import("./base").AbstractBaseProvider<unknown, unknown, unknown>;

/**
 * Built-in registry mapping provider types to their singleton instances.
 */
const builtinProviders: Record<ProviderType, BuiltinProvider> = {
  onlyoffice: onlyOfficeProvider,
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
  openai: openaiProvider,
  openaicompatible: openaicompatibleProvider,
  together: togetherProvider,
  openrouter: openrouterProvider,
  genai: genaiProvider,
  deepseek: deepseekProvider,
  xai: xaiProvider,
  "lm-studio": lmStudioProvider,
  mistral: mistralProvider,
  groq: groqProvider,
  zhipu: zhipuProvider,
  stabilityai: stabilityaiProvider,
  gpt4all: gpt4allProvider,
};

/**
 * Dynamic registry for custom providers added at runtime.
 */
const customProviders: Map<string, BaseProvider> = new Map();

/**
 * Register a custom provider at runtime so it can be looked up by
 * {@link getProvider} and included in {@link getSupportedProviderTypes}.
 *
 * Custom providers must extend
 * {@link import("./base").AbstractBaseProvider | AbstractBaseProvider} and
 * implement all abstract methods. Once registered, the provider type
 * string can be used in profiles, threads, and the UI just like a
 * built-in provider.
 *
 * @param type - A unique string identifier for the provider
 *   (e.g., `"my-custom-llm"`). Must not collide with built-in types.
 * @param provider - The provider instance to register.
 *
 * @example
 * ```ts
 * import { registerProvider, getProvider } from "@onlyoffice/ai-chat";
 *
 * // Register at app startup
 * registerProvider("my-llm", new MyLLMProvider());
 *
 * // Now it is discoverable
 * const provider = getProvider("my-llm"); // MyLLMProvider instance
 * ```
 */
export const registerProvider = (
  type: string,
  provider: BaseProvider
): void => {
  customProviders.set(type, provider);
};

/**
 * Unregister a previously registered custom provider. Has no effect on
 * built-in providers. After removal, {@link getProvider} will return
 * `undefined` for this type.
 *
 * @param type - The provider type string to remove.
 */
export const unregisterProvider = (type: string): void => {
  customProviders.delete(type);
};

/**
 * Look up a provider instance by its type string. Checks built-in
 * providers first, then falls back to the custom provider registry.
 *
 * @param type - The provider type identifier (e.g., `"openai"`, `"anthropic"`,
 *   or a custom type registered via {@link registerProvider}).
 * @returns The provider instance, or `undefined` if no provider is
 *   registered under the given type.
 *
 * @example
 * ```ts
 * import { getProvider } from "@onlyoffice/ai-chat";
 *
 * const openai = getProvider("openai");
 * if (openai) {
 *   openai.setApiKey("sk-...");
 *   const models = await openai.getProviderModels({
 *     url: openai.getBaseUrl(),
 *     apiKey: "sk-...",
 *   });
 * }
 * ```
 */
export const getProvider = (type: string): BaseProvider | undefined => {
  return builtinProviders[type as ProviderType] ?? customProviders.get(type);
};

/**
 * Check whether a provider type is recognized (either built-in or
 * registered as a custom provider).
 *
 * @param type - The provider type string to check.
 * @returns `true` if the type maps to a known provider.
 */
export const isValidProviderType = (type: string): boolean => {
  return type in builtinProviders || customProviders.has(type);
};

/**
 * Get all supported provider type strings, combining both built-in
 * and custom-registered providers.
 *
 * @returns An array of provider type identifier strings.
 */
export const getSupportedProviderTypes = (): string[] => {
  return [...Object.keys(builtinProviders), ...customProviders.keys()];
};

/**
 * Factory map for creating new (non-singleton) provider instances.
 */
const builtinFactories: Record<ProviderType, () => BuiltinProvider> = {
  anthropic: () => new AnthropicProvider(),
  ollama: () => new OllamaProvider(),
  openai: () => new OpenAIProvider(),
  openaicompatible: () => new OpenAICompatibleProvider(),
  together: () => new TogetherProvider(),
  openrouter: () => new OpenRouterProvider(),
  genai: () => new GenAIProvider(),
  deepseek: () => new DeepSeekProvider(),
  xai: () => new XAIProvider(),
  "lm-studio": () => new LMStudioProvider(),
  mistral: () => new MistralProvider(),
  groq: () => new GroqProvider(),
  zhipu: () => new ZhipuProvider(),
  stabilityai: () => new StabilityAIProvider(),
  gpt4all: () => new GPT4AllProvider(),
  onlyoffice: () => new OnlyOfficeProvider(),
};

/**
 * Create a new provider instance (not the shared singleton) for the
 * given type. Only works for built-in provider types. Useful when you
 * need an isolated provider instance that will not share state with the
 * global singleton returned by {@link getProvider}.
 *
 * @param type - The built-in provider type to instantiate.
 * @returns A fresh provider instance, or `undefined` if the type is
 *   not a recognized built-in provider.
 */
export const createProvider = (type: string): BaseProvider | undefined => {
  const factory = builtinFactories[type as ProviderType];
  return factory?.();
};

// Keep backward compat export
export const providerRegistry = builtinProviders;
