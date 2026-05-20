import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";
import { openrouterInfo } from "./info";

/** Shape of one entry in OpenRouter's `/models` response. */
type OpenRouterModel = {
  id: string;
  architecture?: { modality?: string };
  context_length?: number;
};

/**
 * Derive a capability bitmask from OpenRouter's modality string.
 *
 * OpenRouter encodes I/O modalities as strings like
 * `"text+image->text"` (inputs on the left, outputs on the right,
 * `+`-joined). We parse those to decide whether a model can chat, see
 * images, hear audio, or produce images.
 *
 * | contains                 | capabilities adds |
 * |--------------------------|-------------------|
 * | `embedding` (in or out)  | Embeddings (exclusive) |
 * | text out + text/image/audio in | Chat         |
 * | image in                 | Vision            |
 * | audio in                 | Audio             |
 * | image out + image in     | Image             |
 *
 * If nothing matches, defaults to `Chat` so the model is still usable.
 */
export const inferCapabilities = (model: OpenRouterModel): number => {
  const modality = model.architecture?.modality ?? "";
  if (!modality) return CapabilitiesUI.Chat;

  const [input, output] = modality.split("->");
  const modIn = input?.split("+") ?? [];
  const modOut = output?.split("+") ?? [];

  if (modIn.includes("embedding") || modOut.includes("embedding")) {
    return CapabilitiesUI.Embeddings;
  }

  let caps = 0;
  if (modOut.includes("text")) {
    if (
      modIn.includes("text") ||
      modIn.includes("image") ||
      modIn.includes("audio")
    ) {
      caps |= CapabilitiesUI.Chat;
    }
    if (modIn.includes("image")) caps |= CapabilitiesUI.Vision;
    if (modIn.includes("audio")) caps |= CapabilitiesUI.Audio;
  }
  if (modOut.includes("image") && modIn.includes("image")) {
    caps |= CapabilitiesUI.Image;
  }
  return caps || CapabilitiesUI.Chat;
};

/**
 * Validate OpenRouter credentials by hitting the authenticated-user
 * models endpoint via raw fetch. OpenRouter returns structured errors
 * that the OpenAI SDK doesn't classify well, so we drive it ourselves.
 */
export const checkCredentials = async (
  creds: ProviderCredentials
): Promise<boolean | TErrorData> => {
  try {
    const response = await (creds.fetch ?? fetch)(
      `${creds.baseUrl}/models/user`,
      {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      }
    );
    if (!response.ok) {
      if (!creds.apiKey) return ProviderErrors.emptyKey();
      if (response.status === 401) return ProviderErrors.invalidKey();
      return ProviderErrors.invalidUrl();
    }
    return true;
  } catch {
    return ProviderErrors.connectionFailed();
  }
};

/**
 * Fetch the OpenRouter catalogue and project each entry into {@link Model}.
 *
 * Marks reasoning-capable ids per
 * {@link openrouterInfo.reasoningModels}. Capability inference runs
 * through {@link inferCapabilities}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const url = creds.baseUrl || openrouterInfo.baseUrl;
  const response = await (creds.fetch ?? fetch)(`${url}/models`, {
    headers: creds.apiKey ? { Authorization: `Bearer ${creds.apiKey}` } : {},
  });
  const json = await response.json();
  const models: OpenRouterModel[] = json.data ?? [];

  return models.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "openrouter" as const,
    reasoning: openrouterInfo.reasoningModels.includes(m.id),
    capabilities: inferCapabilities(m),
  }));
};
