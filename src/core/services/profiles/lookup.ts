import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type { Profile } from "../../types";
import { getProvider } from "../../providers";
import type { ProviderConstructor } from "../../providers";
import type { StorageAdapter } from "../../storage";

/** Read a profile from storage or throw if it is missing. */
export async function loadProfile(
  storage: StorageAdapter,
  id: string
): Promise<Profile> {
  const profile = await storage.profiles.readById(id);
  if (!profile) throw new Error(`Profile not found: ${id}`);
  return profile;
}

/** Look up a concrete provider class by type or throw on unknown type. */
export function providerFor(type: string): ProviderConstructor {
  const Provider = getProvider(type);
  if (!Provider) throw new Error(`Unknown provider type: ${type}`);
  return Provider;
}

/** Map the subset of profile fields used for provider calls. */
export function credsOf(
  input: Pick<Profile, "baseUrl" | "key"> & Partial<Pick<Profile, "headers">>
): ProviderCredentials {
  return {
    baseUrl: input.baseUrl,
    apiKey: input.key,
    ...(input.headers ? { headers: input.headers } : {}),
  };
}
