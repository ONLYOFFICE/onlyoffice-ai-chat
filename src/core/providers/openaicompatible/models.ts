import { createOpenAIClient } from "../openai/client";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Fetch the model list from an arbitrary OpenAI-compatible endpoint.
 *
 * No filtering or capability inference — every model returned by the
 * endpoint is included and tagged with the broad default capability mask
 * (Chat + Vision + Tools). Use this provider when you want full
 * transparency over a self-hosted or third-party OpenAI-compatible API.
 *
 * @param creds - Credentials pointing at the target endpoint.
 * @returns Array of {@link Model} exactly as reported by the endpoint.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  // Build the client through the shared factory: it carries the host's
  // `creds.fetch` proxy (a desktop webview cannot reach http://localhost
  // itself — Bug 81388) and tolerates a missing API key instead of the SDK
  // constructor throwing on an empty one.
  const client = createOpenAIClient(creds);
  const response = await client.models.list();

  const defaultCaps =
    CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;

  return response.data.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "openaicompatible" as const,
    capabilities: defaultCaps,
  }));
};
