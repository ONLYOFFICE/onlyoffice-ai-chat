import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { createMistralClient } from "./client";
import { mistralInfo } from "./info";

/**
 * Infer capabilities from a Mistral model entry.
 *
 * Mistral exposes a per-model `capabilities.vision` flag, but specific
 * id substrings give a more accurate classification:
 *
 * | id contains                               | capabilities     |
 * |-------------------------------------------|------------------|
 * | `mistral-embed`                           | Embeddings       |
 * | `pixtral`                                 | Chat + Vision    |
 * | `mistral-small`, `mistral-medium`,        | Chat             |
 * | `codestral`                               |                  |
 * | everything else (+ `capabilities.vision`) | Chat (+ Vision)  |
 *
 * @param model - Partial model record from Mistral's API.
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (model: {
  id?: string;
  capabilities?: { vision?: boolean };
}): number => {
  const id = model.id ?? "";

  if (id.includes("mistral-embed")) return CapabilitiesUI.Embeddings;
  if (id.includes("pixtral")) {
    return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
  }
  if (id.includes("mistral-small")) return CapabilitiesUI.Chat;
  if (id.includes("mistral-medium")) return CapabilitiesUI.Chat;
  if (id.includes("codestral")) return CapabilitiesUI.Chat;

  let caps = CapabilitiesUI.Chat;
  if (model.capabilities?.vision) caps |= CapabilitiesUI.Vision;
  return caps;
};

/**
 * Resolve a reasoning model alias.
 *
 * Mistral's reasoning variants live under separate model ids rather than
 * a flag — {@link mistralInfo.reasoningModels} maps "level substring" →
 * "reasoning model id". When `withReasoning` is set, we swap to the
 * matching reasoning model; otherwise the original id is used.
 *
 * @param model - The requested model id (possibly carrying a level hint).
 * @returns The model id that should actually be sent to the API.
 */
export const resolveReasoningModel = (model: string): string => {
  const reasoningModel = mistralInfo.reasoningModels.find(([level]) =>
    model.includes(level)
  );
  return reasoningModel ? reasoningModel[1] : model;
};

/**
 * Fetch all models from Mistral and decorate each with inferred
 * capabilities.
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of {@link Model}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = createMistralClient(creds);
  const response = await client.models.list();
  const models = response.data ?? [];

  return models.map((m) => ({
    id: m.id ?? "",
    name: m.id ?? "Unknown",
    provider: "mistral" as const,
    capabilities: inferCapabilities(m),
    ...(typeof m.created === "number" ? { created: m.created } : {}),
  }));
};
