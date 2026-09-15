import type { AbstractBaseProvider } from "../providers";
import { createProvider } from "../providers";
import type { ActionArgs } from "./types";

/**
 * Instantiate the provider class configured by the action's `profile`,
 * importing its SDK on first use. Throws on unknown provider type — the
 * shared error path every action used to repeat inline.
 */
export async function providerFor(
  args: ActionArgs
): Promise<AbstractBaseProvider> {
  const provider = await createProvider(args.profile.providerType, {
    baseUrl: args.profile.baseUrl,
    apiKey: args.profile.key,
    ...(args.fetch ? { fetch: args.fetch } : {}),
    ...(args.threadId ? { sessionId: args.threadId } : {}),
    ...(args.entityId ? { entityId: args.entityId } : {}),
    ...(args.entityTitle ? { entityTitle: args.entityTitle } : {}),
    ...(args.source ? { source: args.source } : {}),
    ...(args.profile.basedOn ? { basedOn: args.profile.basedOn } : {}),
    ...(args.profile.headers ? { headers: args.profile.headers } : {}),
    ...(args.profile.reasoningSupport
      ? { reasoningSupport: args.profile.reasoningSupport }
      : {}),
  });
  if (!provider) {
    throw new Error(`Unknown provider type: ${args.profile.providerType}`);
  }
  return provider;
}
