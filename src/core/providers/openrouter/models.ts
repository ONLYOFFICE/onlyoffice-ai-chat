import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";
import { openrouterInfo } from "./info";

/** Shape of one entry in OpenRouter's `/models` response. */
type OpenRouterModel = {
  id: string;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  context_length?: number;
};

/**
 * Derive a capability bitmask from OpenRouter's modality fields.
 *
 * Prefers the explicit `input_modalities` / `output_modalities` arrays
 * (available since OpenRouter's extended model schema) and falls back
 * to parsing the legacy `modality` string (`"text+image->text"`) when
 * the arrays are absent.
 *
 * | modality                 | capabilities adds              |
 * |--------------------------|--------------------------------|
 * | `embedding` (in or out)  | Embeddings (exclusive)         |
 * | text out + any text/image/audio/video in | Chat         |
 * | image or video in        | Vision                         |
 * | audio in                 | Audio                          |
 * | image out + image in     | Image                          |
 *
 * If nothing matches, defaults to `Chat` so the model is still usable.
 */
export const inferCapabilities = (model: OpenRouterModel): number => {
  const arch = model.architecture;
  if (!arch) return CapabilitiesUI.Chat;

  let modIn: string[];
  let modOut: string[];

  if (arch.input_modalities || arch.output_modalities) {
    modIn = arch.input_modalities ?? [];
    modOut = arch.output_modalities ?? [];
  } else {
    const modality = arch.modality ?? "";
    if (!modality) return CapabilitiesUI.Chat;
    const [input, output] = modality.split("->");
    modIn = input?.split("+") ?? [];
    modOut = output?.split("+") ?? [];
  }

  if (modIn.includes("embedding") || modOut.includes("embedding")) {
    return CapabilitiesUI.Embeddings;
  }

  let caps = 0;
  if (modOut.includes("text")) {
    if (
      modIn.includes("text") ||
      modIn.includes("image") ||
      modIn.includes("video") ||
      modIn.includes("audio")
    ) {
      caps |= CapabilitiesUI.Chat;
    }
    if (modIn.includes("image") || modIn.includes("video"))
      caps |= CapabilitiesUI.Vision;
    if (modIn.includes("audio")) caps |= CapabilitiesUI.Audio;
  }
  // Any model that can produce images gets the Image flag regardless of
  // what it accepts as input — this covers both text-to-image (text in,
  // image out) and image-editing (image in, image out) models.
  if (modOut.includes("image")) {
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
  if (!response.ok) return [];
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
