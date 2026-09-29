import OpenAI from "openai";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { deepseekInfo } from "./info";

/**
 * Fetch the DeepSeek model list via the OpenAI-compatible API.
 *
 * DeepSeek exposes the same `/v1/models` shape as OpenAI. We mark
 * models whose id contains `reasoner` as reasoning-capable, set the
 * broad default capability mask (Chat + Vision + Tools), and reverse
 * the order so the newest models come first.
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of {@link Model}, newest-first.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl || deepseekInfo.baseUrl,
    dangerouslyAllowBrowser: true,
  });

  const response = (await client.models.list()).data;

  const defaultCaps =
    CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;

  const models: Model[] = response.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "deepseek" as const,
    reasoning: m.id.includes("reasoner"),
    capabilities: defaultCaps,
    ...(typeof m.created === "number" ? { created: m.created } : {}),
  }));

  // Reversal stays as the ordering fallback for catalogues that report no
  // `created` timestamp; where one is present the picker sorts on it.
  return models.reverse();
};
