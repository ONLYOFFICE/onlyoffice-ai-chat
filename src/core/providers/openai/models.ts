import type { Model as OpenAIModel } from "openai/resources/models";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { createOpenAIClient } from "./client";
import { openaiInfo } from "./info";

/**
 * Infer capabilities from an OpenAI model id.
 *
 * OpenAI's `/v1/models` endpoint returns ids but no capability metadata,
 * so we classify by known substrings:
 *
 * | id contains                              | capabilities     |
 * |-----------------------------------------|------------------|
 * | `whisper`, `tts-1`                      | Audio            |
 * | `embedding`                             | Embeddings       |
 * | `dall-e-2`, `dall-e-3`, `-image-`       | Image            |
 * | `gpt-3.5-turbo-instruct`                | Chat only        |
 * | everything else                         | Chat + Vision    |
 *
 * @param id - Model id as returned by the OpenAI API.
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (id: string): number => {
  if (id.includes("whisper") || id.includes("tts-1")) {
    return CapabilitiesUI.Audio;
  }
  if (id.includes("embedding")) {
    return CapabilitiesUI.Embeddings;
  }
  if (id === "dall-e-2" || id === "dall-e-3" || id.includes("-image")) {
    return CapabilitiesUI.Image;
  }
  if (id.includes("gpt-3.5-turbo-instruct")) {
    return CapabilitiesUI.Chat;
  }
  return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
};

/**
 * Fetch the full model list for an OpenAI endpoint and decorate each
 * entry with inferred capabilities and the `reasoning` flag for models
 * listed in {@link openaiInfo.reasoningModels}.
 *
 * Throws whatever the SDK throws on network / auth failures — callers
 * wrap this in `checkProvider`-style error mapping as needed.
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of {@link Model}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = createOpenAIClient(creds);
  const response: OpenAIModel[] = (await client.models.list()).data;

  return response.map((model) => ({
    id: model.id,
    name: model.id,
    provider: "openai" as const,
    reasoning: openaiInfo.reasoningModels.includes(model.id),
    capabilities: inferCapabilities(model.id),
  }));
};
