import type { BuiltinProviderType } from "./builtin-provider-type";

/**
 * Provider type identifier. Accepts all 16 built-in types with autocomplete,
 * plus any custom `string` for dynamically registered providers.
 *
 * @example
 * ```ts
 * const builtin: ProviderType = "anthropic"; // autocomplete works
 * const custom: ProviderType = "my-custom";  // also valid
 * ```
 *
 * @see {@link BuiltinProviderType} for just the built-in values.
 */
export type ProviderType = BuiltinProviderType | (string & {});
