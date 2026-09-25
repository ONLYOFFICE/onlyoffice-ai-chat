import OpenAI from "openai";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import {
  reasoningSupportFromCatalog,
  type OpenRouterReasoningMeta,
} from "../openrouter/reasoning";

/**
 * Fetch the model list from the ONLYOFFICE OpenAI-compatible endpoint.
 *
 * No filtering or capability inference — every model returned by the
 * endpoint is included and tagged with the broad default capability mask
 * (Chat + Vision + Tools). The route proxies OpenRouter's catalogue, so an
 * entry's `reasoning` object (OpenRouter's shape) is read the same way.
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

  return response.data.map((m) => {
    // The SDK types only OpenAI's fields; the route adds OpenRouter's
    // `reasoning` object next to them.
    const meta = (m as { reasoning?: OpenRouterReasoningMeta | null })
      .reasoning;
    return {
      id: m.id,
      name: m.id,
      provider: "onlyoffice" as const,
      ...(meta !== undefined ? { reasoning: meta !== null } : {}),
      reasoningSupport: reasoningSupportFromCatalog(meta, m.id),
      capabilities: defaultCaps,
      ...(typeof m.created === "number" ? { created: m.created } : {}),
    };
  });
};
