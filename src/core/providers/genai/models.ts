import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { createGenAIClient } from "./client";

/**
 * Whether a Gemini model id denotes an image-generation model.
 *
 * `supportedGenerationMethods` alone cannot answer this: Imagen models
 * are identifiable by their `predict` method, but the Gemini-native
 * image models marketed as Nano Banana (`gemini-2.5-flash-image`,
 * `gemini-3-pro-image-preview`, …) generate images through the very same
 * `generateContent` method as every chat model. The `image` segment in
 * the id is the only signal that separates them.
 *
 * @param modelId - Model id without the `models/` prefix.
 * @returns `true` when the model produces images.
 */
export const isImageModel = (modelId: string): boolean => {
  const id = modelId.toLowerCase();
  return id.includes("imagen") || id.includes("image");
};

/**
 * Infer capabilities from a Gemini model entry.
 *
 * Gemini exposes `supportedGenerationMethods` on each model — we treat
 * `embedContent` as embeddings-only, image models (per
 * {@link isImageModel} or a `predict`-style method) as image-only, and
 * everything else as full chat + vision + tools. Missing / unexpected
 * method lists also fall through to the broad default.
 *
 * @param methods - The `supportedGenerationMethods` array, if any.
 * @param modelId - Model id, used to spot Gemini-native image models
 *   that advertise no distinguishing method.
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (methods: string[], modelId = ""): number => {
  if (methods.includes("embedContent")) return CapabilitiesUI.Embeddings;
  if (
    isImageModel(modelId) ||
    methods.includes("predict") ||
    methods.includes("predictLongRunning")
  )
    return CapabilitiesUI.Image;
  return CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;
};

/**
 * Fetch all pages of Gemini models and project them into {@link Model}.
 *
 * The GenAI SDK returns a pager — we walk every page until `hasNextPage`
 * reports false. Each entry is classified via {@link inferCapabilities}.
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of {@link Model}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = createGenAIClient(creds);
  const pager = await client.models.list();

  const models: Model[] = [];
  let page = await pager.page;

  while (page.length > 0) {
    for (const model of page) {
      const modelId = model.name?.replace("models/", "") ?? "";
      const methods =
        (model as unknown as Record<string, string[]>)
          .supportedGenerationMethods ?? [];

      models.push({
        id: modelId,
        name: model.displayName || modelId,
        provider: "genai" as const,
        capabilities: inferCapabilities(methods, modelId),
      });
    }

    if (!pager.hasNextPage()) break;
    page = await pager.nextPage();
  }

  return models;
};
