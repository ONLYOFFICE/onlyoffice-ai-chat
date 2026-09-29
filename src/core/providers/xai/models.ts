import OpenAI from "openai";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { xaiInfo } from "./info";

/**
 * Infer capabilities from an xAI (Grok) model id.
 *
 * | id contains          | capabilities      |
 * |----------------------|-------------------|
 * | `vision`             | Chat + Vision     |
 * | `image` / `imagine`  | Image             |
 * | `video`              | Image             |
 * | otherwise            | Chat              |
 *
 * `grok-imagine-*` ids are xAI's image/video generation family — they do
 * not answer chat completions, so classifying them as Chat made the model
 * form default to one right after connecting the provider (Bug 83730).
 * There is no dedicated Video capability bit; Image is the closest
 * non-chat classification and keeps them out of every chat picker.
 *
 * @param id - Model id as returned by the xAI API.
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (id: string): number => {
  if (id.includes("vision")) {
    return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
  }
  if (id.includes("image") || id.includes("imagine") || id.includes("video")) {
    return CapabilitiesUI.Image;
  }
  return CapabilitiesUI.Chat;
};

/**
 * Fetch the xAI model list via the OpenAI-compatible API.
 *
 * Marks models containing `reasoning` in their id as reasoning-capable.
 * The order is reversed so newest models come first (xAI lists oldest
 * first by default).
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of {@link Model}, newest-first.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl || xaiInfo.baseUrl,
    dangerouslyAllowBrowser: true,
  });

  const response = (await client.models.list()).data;

  const models: Model[] = response.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "xai" as const,
    reasoning: m.id.includes("reasoning"),
    capabilities: inferCapabilities(m.id),
    ...(typeof m.created === "number" ? { created: m.created } : {}),
  }));

  // Reversal stays as the ordering fallback for catalogues that report no
  // `created` timestamp; where one is present the picker sorts on it.
  return models.reverse();
};
