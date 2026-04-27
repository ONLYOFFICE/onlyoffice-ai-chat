import OpenAI from "openai";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { groqInfo } from "./info";

/**
 * Infer capabilities from a Groq model id.
 *
 * Groq always supports Chat + Tools; vision-capable models add Vision.
 * `whisper` models are audio-only and filtered out before this runs.
 *
 * @param id - Model id (lowercased before comparison).
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (id: string): number => {
  let caps = CapabilitiesUI.Chat | CapabilitiesUI.Tools;
  if (id.includes("vision")) caps |= CapabilitiesUI.Vision;
  return caps;
};

/**
 * Fetch the Groq model list via the OpenAI-compatible API.
 *
 * Excludes `whisper` entries — Groq's Whisper variants are audio-only
 * and not usable for chat.
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of chat-capable {@link Model}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl || groqInfo.baseUrl,
    dangerouslyAllowBrowser: true,
  });

  const response = (await client.models.list()).data;

  return response
    .filter((m) => !m.id.toLowerCase().includes("whisper"))
    .map((m) => ({
      id: m.id,
      name: m.id,
      provider: "groq" as const,
      capabilities: inferCapabilities(m.id.toLowerCase()),
    }));
};
