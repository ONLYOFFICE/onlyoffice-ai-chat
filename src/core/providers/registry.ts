import type { ProviderCredentials } from "../../shared/provider-credentials";
import type { ProviderType } from "../../shared/provider-type";

import type { AbstractBaseProvider, ProviderConstructor } from "./base";
import { AnthropicProvider } from "./anthropic";
import { DeepSeekProvider } from "./deepseek";
import { ExternalProvider } from "./external";
import { GenAIProvider } from "./genai";
import { GPT4AllProvider } from "./gpt4all";
import { GroqProvider } from "./groq";
import { LMStudioProvider } from "./lm-studio";
import { MistralProvider } from "./mistral";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { OpenAICompatibleProvider } from "./openaicompatible";
import { OpenRouterProvider } from "./openrouter";
import { StabilityAIProvider } from "./stabilityai";
import { TogetherProvider } from "./together";
import { XAIProvider } from "./xai";
import { ZhipuProvider } from "./zhipu";

/**
 * Any provider class — built-in or custom — that satisfies the static
 * contract defined in {@link ProviderConstructor}. Kept as a distinct
 * alias because it is re-exported through the public SDK surface; any
 * class matching `ProviderConstructor` is also a `BaseProvider`.
 */
export type BaseProvider = ProviderConstructor;

// `Partial` because not every known provider type is registered as a
// built-in (e.g. `onlyoffice` ships as a class but is intentionally left
// unregistered). `getProvider` already returns `undefined` for misses.
const builtinProviders: Partial<Record<ProviderType, ProviderConstructor>> = {
  openrouter: OpenRouterProvider,
  anthropic: AnthropicProvider,
  ollama: OllamaProvider,
  openai: OpenAIProvider,
  openaicompatible: OpenAICompatibleProvider,
  together: TogetherProvider,
  genai: GenAIProvider,
  deepseek: DeepSeekProvider,
  xai: XAIProvider,
  "lm-studio": LMStudioProvider,
  mistral: MistralProvider,
  groq: GroqProvider,
  zhipu: ZhipuProvider,
  stabilityai: StabilityAIProvider,
  gpt4all: GPT4AllProvider,
  external: ExternalProvider,
};

const customProviders = new Map<string, ProviderConstructor>();

/**
 * Register a custom provider class at runtime. The class must satisfy
 * the static contract in {@link ProviderConstructor}.
 */
export const registerProvider = (
  type: string,
  ctor: ProviderConstructor
): void => {
  customProviders.set(type, ctor);
};

/**
 * Unregister a previously registered custom provider. Has no effect on
 * built-in providers.
 */
export const unregisterProvider = (type: string): void => {
  customProviders.delete(type);
};

/**
 * Look up a provider class by its type string. Checks built-in providers
 * first, then custom. Returns `undefined` if not found.
 */
export const getProvider = (type: string): ProviderConstructor | undefined => {
  return builtinProviders[type as ProviderType] ?? customProviders.get(type);
};

export const isValidProviderType = (type: string): boolean => {
  return type in builtinProviders || customProviders.has(type);
};

export const getSupportedProviderTypes = (): string[] => {
  return [...Object.keys(builtinProviders), ...customProviders.keys()];
};

/**
 * Instantiate a provider for the given type, creating the SDK client from
 * the supplied credentials. Returns `undefined` if the type is unknown.
 */
export const createProvider = (
  type: string,
  creds: ProviderCredentials
): AbstractBaseProvider | undefined => {
  const Ctor = getProvider(type);
  return Ctor ? new Ctor(creds) : undefined;
};
