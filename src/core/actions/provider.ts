import type { AbstractBaseProvider } from "../providers";
import { createProvider } from "../providers";
import type { ActionArgs } from "./types";

/**
 * Instantiate the provider class configured by the action's `profile`.
 * Throws on unknown provider type — the shared error path every action
 * used to repeat inline.
 */
export function providerFor(args: ActionArgs): AbstractBaseProvider {
  const provider = createProvider(args.profile.providerType, {
    baseUrl: args.profile.baseUrl,
    apiKey: args.profile.key,
    ...(args.fetch ? { fetch: args.fetch } : {}),
  });
  if (!provider) {
    throw new Error(`Unknown provider type: ${args.profile.providerType}`);
  }
  return provider;
}
