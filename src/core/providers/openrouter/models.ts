import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";
import { openrouterInfo } from "./info";
import {
  reasoningSupportFromCatalog,
  type OpenRouterReasoningMeta,
} from "./reasoning";

/** Shape of one entry in OpenRouter's `/models` response. */
type OpenRouterModel = {
  id: string;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  context_length?: number;
  /**
   * Request parameters the model actually accepts. The only per-model
   * tool-calling signal any provider in this repo exposes — presence of
   * `"tools"` here is authoritative, its absence means no tool support.
   */
  supported_parameters?: string[];
  /**
   * Per-model thinking capabilities; `null` on models without thinking.
   * Absent on older catalogues, in which case the id-based table answers.
   */
  reasoning?: OpenRouterReasoningMeta | null;
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
 * | `supported_parameters` has `tools` | Tools                |
 *
 * If nothing matches, defaults to `Chat` so the model is still usable.
 */
export const inferCapabilities = (model: OpenRouterModel): number => {
  // Read off `supported_parameters` rather than guessed from the id: this
  // is real per-model metadata, so it is applied even when the modality
  // fields are missing entirely.
  const toolsCap = model.supported_parameters?.includes("tools")
    ? CapabilitiesUI.Tools
    : 0;

  const arch = model.architecture;
  if (!arch) return CapabilitiesUI.Chat | toolsCap;

  let modIn: string[];
  let modOut: string[];

  if (arch.input_modalities || arch.output_modalities) {
    modIn = arch.input_modalities ?? [];
    modOut = arch.output_modalities ?? [];
  } else {
    const modality = arch.modality ?? "";
    if (!modality) return CapabilitiesUI.Chat | toolsCap;
    const [input, output] = modality.split("->");
    modIn = input?.split("+") ?? [];
    modOut = output?.split("+") ?? [];
  }

  // Embeddings is exclusive — an embedding endpoint takes no tools.
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
  caps |= toolsCap;
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
 * Build the `/models` request URL, carrying the catalogue query in a way
 * that survives a `baseUrl` that already has its own query string.
 *
 * `sort=most-popular` asks OpenRouter to rank the catalogue by usage, the
 * only popularity signal it offers — the response carries no per-model
 * usage figure, so the ranking exists purely as the array order and is
 * preserved by listing the models exactly as they arrive. `limit` is
 * raised past the endpoint's 500 default because the catalogue is already
 * ~460 entries and a silent truncation would drop real models.
 *
 * A base URL that isn't parseable (a relative proxy path, say) falls back
 * to plain string concatenation with no query — the caller still gets an
 * unranked catalogue rather than an exception.
 */
const buildModelsUrl = (baseUrl: string): string => {
  try {
    const url = new URL(`${baseUrl.replace(/\/+$/, "")}/models`);
    url.searchParams.set("sort", "most-popular");
    url.searchParams.set("limit", "1000");
    return url.toString();
  } catch {
    return `${baseUrl}/models`;
  }
};

/**
 * Fetch the OpenRouter catalogue and project each entry into {@link Model}.
 *
 * The catalogue's `reasoning` object says whether and how a model thinks;
 * {@link openrouterInfo.reasoningModels} is the fallback for catalogues that
 * predate the field. Capability inference runs through
 * {@link inferCapabilities}.
 *
 * The response order is the ranking — see {@link buildModelsUrl} — so the
 * catalogue is projected as-is and no per-model ordering field is emitted.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const url = creds.baseUrl || openrouterInfo.baseUrl;
  const response = await (creds.fetch ?? fetch)(buildModelsUrl(url), {
    headers: creds.apiKey ? { Authorization: `Bearer ${creds.apiKey}` } : {},
  });
  if (!response.ok) return [];
  const json = await response.json();
  const models: OpenRouterModel[] = json.data ?? [];

  return models.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "openrouter" as const,
    reasoning:
      m.reasoning !== undefined
        ? m.reasoning !== null
        : openrouterInfo.reasoningModels.includes(m.id),
    reasoningSupport: reasoningSupportFromCatalog(m.reasoning, m.id),
    capabilities: inferCapabilities(m),
  }));
};
