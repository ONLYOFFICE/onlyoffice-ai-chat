import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { createGenAIClient } from "./client";

/**
 * Infer capabilities from a Gemini model entry.
 *
 * Gemini exposes `supportedGenerationMethods` on each model — we treat
 * `embedContent` as embeddings-only, everything else as full chat +
 * vision + tools. Missing / unexpected method lists also fall through to
 * the broad default.
 *
 * @param methods - The `supportedGenerationMethods` array, if any.
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (methods: string[]): number => {
  if (methods.includes("embedContent")) return CapabilitiesUI.Embeddings;
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
        capabilities: inferCapabilities(methods),
      });
    }

    if (!pager.hasNextPage()) break;
    page = await pager.nextPage();
  }

  return models;
};
