import OpenAI from "openai";
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
  const client = new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: true,
  });
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
