export { AbstractBaseProvider } from "./base";
export type { ProviderConstructor } from "./base";

export {
  createProvider,
  loadProvider,
  getProviderMetadata,
  getProviderName,
  getReasoningSupport,
  getSupportedProviderTypes,
  isValidProviderType,
  registerProvider,
  unregisterProvider,
} from "./registry";
export type { BaseProvider, ProviderMetadata } from "./registry";

// The catalogue → ReasoningSupport converter, for hosts that rebuild the
// OpenRouter / ONLYOFFICE model list themselves (the DocSpace server does).
export {
  reasoningSupportFromCatalog,
  type OpenRouterReasoningMeta,
} from "./openrouter/reasoning";

export {
  ProviderErrors,
  extractErrorMessage,
  getErrorCode,
  getErrorStatus,
  mapFetchError,
} from "./errors";
