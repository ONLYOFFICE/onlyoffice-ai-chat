import type { ProviderCredentials } from "../../shared/provider-credentials";
import type { ProviderType } from "../../shared/provider-type";

import type { AbstractBaseProvider, ProviderConstructor } from "./base";

// SDK-free provider metadata (name + base URL). These `*Info` modules carry
// no vendor SDK import, so the whole set can be pulled eagerly and read
// synchronously by the UI (dropdowns, labels) without bundling any SDK.
import { anthropicInfo } from "./anthropic/info";
import { deepseekInfo } from "./deepseek/info";
import { externalInfo } from "./external/info";
import { genaiInfo } from "./genai/info";
import { gpt4allInfo } from "./gpt4all/info";
import { groqInfo } from "./groq/info";
import { lmStudioInfo } from "./lm-studio/info";
import { mistralInfo } from "./mistral/info";
import { ollamaInfo } from "./ollama/info";
import { onlyOfficeInfo } from "./onlyoffice/info";
import { openaiInfo } from "./openai/info";
import { openaicompatibleInfo } from "./openaicompatible/info";
import { openrouterInfo } from "./openrouter/info";
import { stabilityaiInfo } from "./stabilityai/info";
import { togetherInfo } from "./together/info";
import { xaiInfo } from "./xai/info";
import { zhipuInfo } from "./zhipu/info";

/**
 * Any provider class — built-in or custom — that satisfies the static
 * contract defined in {@link ProviderConstructor}. Kept as a distinct
 * alias because it is re-exported through the public SDK surface; any
 * class matching `ProviderConstructor` is also a `BaseProvider`.
 */
export type BaseProvider = ProviderConstructor;

/** Lightweight provider identity — safe to read synchronously anywhere. */
export type ProviderMetadata = {
  name: string;
  baseUrl: string;
};

// `Partial` because not every known provider type is registered as a
// built-in. `getProviderMetadata` / `loadProvider` return `undefined` for
// misses.
//
// `onlyoffice` is registered so host-supplied profiles loaded from storage
// resolve and run, but it is intentionally filtered out of the manual
// add-profile dropdown in the UI (see `ModelConfigForm`).
const builtinMetadata: Partial<Record<ProviderType, ProviderMetadata>> = {
  openai: { name: openaiInfo.name, baseUrl: openaiInfo.baseUrl },
  genai: { name: genaiInfo.name, baseUrl: genaiInfo.baseUrl },
  anthropic: { name: anthropicInfo.name, baseUrl: anthropicInfo.baseUrl },
  xai: { name: xaiInfo.name, baseUrl: xaiInfo.baseUrl },
  stabilityai: { name: stabilityaiInfo.name, baseUrl: stabilityaiInfo.baseUrl },
  deepseek: { name: deepseekInfo.name, baseUrl: deepseekInfo.baseUrl },
  mistral: { name: mistralInfo.name, baseUrl: mistralInfo.baseUrl },
  together: { name: togetherInfo.name, baseUrl: togetherInfo.baseUrl },
  groq: { name: groqInfo.name, baseUrl: groqInfo.baseUrl },
  openrouter: { name: openrouterInfo.name, baseUrl: openrouterInfo.baseUrl },
  ollama: { name: ollamaInfo.name, baseUrl: ollamaInfo.baseUrl },
  "lm-studio": { name: lmStudioInfo.name, baseUrl: lmStudioInfo.baseUrl },
  zhipu: { name: zhipuInfo.name, baseUrl: zhipuInfo.baseUrl },
  gpt4all: { name: gpt4allInfo.name, baseUrl: gpt4allInfo.baseUrl },
  openaicompatible: {
    name: openaicompatibleInfo.name,
    baseUrl: openaicompatibleInfo.baseUrl,
  },
  onlyoffice: { name: onlyOfficeInfo.name, baseUrl: onlyOfficeInfo.baseUrl },
  external: { name: externalInfo.name, baseUrl: externalInfo.baseUrl },
};

type ProviderLoader = () => Promise<ProviderConstructor>;

// Lazy class loaders — each vendor SDK is imported only when its provider is
// actually instantiated, so a consumer that uses one provider no longer
// bundles the SDKs of the other 16 (and a server can install just the SDK it
// uses without the eager registry crashing on a missing optional peer).
// Order mirrors `builtinMetadata` so `getSupportedProviderTypes` is stable.
const builtinLoaders: Partial<Record<ProviderType, ProviderLoader>> = {
  openai: () => import("./openai").then((m) => m.OpenAIProvider),
  genai: () => import("./genai").then((m) => m.GenAIProvider),
  anthropic: () => import("./anthropic").then((m) => m.AnthropicProvider),
  xai: () => import("./xai").then((m) => m.XAIProvider),
  stabilityai: () => import("./stabilityai").then((m) => m.StabilityAIProvider),
  deepseek: () => import("./deepseek").then((m) => m.DeepSeekProvider),
  mistral: () => import("./mistral").then((m) => m.MistralProvider),
  together: () => import("./together").then((m) => m.TogetherProvider),
  groq: () => import("./groq").then((m) => m.GroqProvider),
  openrouter: () => import("./openrouter").then((m) => m.OpenRouterProvider),
  ollama: () => import("./ollama").then((m) => m.OllamaProvider),
  "lm-studio": () => import("./lm-studio").then((m) => m.LMStudioProvider),
  zhipu: () => import("./zhipu").then((m) => m.ZhipuProvider),
  gpt4all: () => import("./gpt4all").then((m) => m.GPT4AllProvider),
  openaicompatible: () =>
    import("./openaicompatible").then((m) => m.OpenAICompatibleProvider),
  onlyoffice: () => import("./onlyoffice").then((m) => m.OnlyOfficeProvider),
  external: () => import("./external").then((m) => m.ExternalProvider),
};

// Loaded built-in classes are cached so repeated instantiation reuses the
// already-imported module instead of re-awaiting a dynamic import.
const loadedBuiltins = new Map<ProviderType, ProviderConstructor>();
const customProviders = new Map<string, ProviderConstructor>();

/**
 * Register a custom provider class at runtime. The class must satisfy the
 * static contract in {@link ProviderConstructor}. Custom providers are held
 * directly (not lazily) — the caller already has the class in hand.
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
 * Synchronously resolve a provider's lightweight identity (name + base URL)
 * without importing its SDK. Built-ins read from the eager metadata table;
 * custom providers derive it from the registered class's statics. Returns
 * `undefined` for unknown types.
 */
export const getProviderMetadata = (
  type: string
): ProviderMetadata | undefined => {
  const builtin = builtinMetadata[type as ProviderType];
  if (builtin) return builtin;
  const custom = customProviders.get(type);
  if (custom) return { name: custom.getName(), baseUrl: custom.getBaseUrl() };
  return undefined;
};

/** Display name for a provider type, falling back to the raw type string. */
export const getProviderName = (type: string): string =>
  getProviderMetadata(type)?.name ?? type;

/**
 * Load a provider class by type, importing its SDK on first use. Checks
 * custom providers first, then built-ins (cached after the first import).
 * Returns `undefined` if the type is unknown.
 */
export const loadProvider = async (
  type: string
): Promise<ProviderConstructor | undefined> => {
  const custom = customProviders.get(type);
  if (custom) return custom;
  const cached = loadedBuiltins.get(type as ProviderType);
  if (cached) return cached;
  const loader = builtinLoaders[type as ProviderType];
  if (!loader) return undefined;
  const ctor = await loader();
  loadedBuiltins.set(type as ProviderType, ctor);
  return ctor;
};

export const isValidProviderType = (type: string): boolean => {
  return type in builtinLoaders || customProviders.has(type);
};

export const getSupportedProviderTypes = (): string[] => {
  return [...Object.keys(builtinLoaders), ...customProviders.keys()];
};

/**
 * Instantiate a provider for the given type, importing its SDK on first use
 * and creating the client from the supplied credentials. Resolves to
 * `undefined` if the type is unknown.
 */
export const createProvider = async (
  type: string,
  creds: ProviderCredentials
): Promise<AbstractBaseProvider | undefined> => {
  const Ctor = await loadProvider(type);
  return Ctor ? new Ctor(creds) : undefined;
};
