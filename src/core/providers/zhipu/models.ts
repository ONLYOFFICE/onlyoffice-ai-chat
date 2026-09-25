import OpenAI from "openai";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { zhipuInfo } from "./info";

/**
 * Hard-coded fallback list used when ZhiPu's `/models` endpoint errors
 * out. Keeps the UI usable for the common GLM-4 family even if the
 * catalogue temporarily fails to load.
 */
const FALLBACK_MODELS: Model[] = [
  {
    id: "glm-4",
    name: "glm-4",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-0520",
    name: "glm-4-0520",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-air",
    name: "glm-4-air",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-airx",
    name: "glm-4-airx",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-flash",
    name: "glm-4-flash",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-plus",
    name: "glm-4-plus",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-long",
    name: "glm-4-long",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-alltools",
    name: "glm-4-alltools",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "cogview-3",
    name: "cogview-3",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Image,
  },
];

/**
 * Derive a capability bitmask from a ZhiPu model id.
 *
 * | id contains            | capabilities     |
 * |------------------------|------------------|
 * | `cogview`, `image`     | Image            |
 * | everything else        | Chat + Tools     |
 */
export const inferCapabilities = (id: string): number => {
  const normalized = id.toLowerCase();
  if (normalized.includes("cogview") || normalized.includes("image")) {
    return CapabilitiesUI.Image;
  }
  return CapabilitiesUI.Chat | CapabilitiesUI.Tools;
};

/**
 * Fetch ZhiPu's model catalogue via the OpenAI-compatible API. Falls
 * back to {@link FALLBACK_MODELS} when the endpoint is unreachable.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  try {
    const client = new OpenAI({
      apiKey: creds.apiKey,
      baseURL: creds.baseUrl || zhipuInfo.baseUrl,
      dangerouslyAllowBrowser: true,
    });
    const response = (await client.models.list()).data;

    return response.map((m) => ({
      id: m.id,
      name: m.id,
      provider: "zhipu" as const,
      capabilities: inferCapabilities(m.id),
      ...(typeof m.created === "number" ? { created: m.created } : {}),
    }));
  } catch {
    return FALLBACK_MODELS;
  }
};
