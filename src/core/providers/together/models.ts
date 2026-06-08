import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/** Shape of one entry in Together's `/models` response. */
type TogetherModel = {
  id: string;
  type?: string;
};

/**
 * Derive a capability bitmask from Together's per-model `type` field.
 *
 * | type        | capabilities                                        |
 * |-------------|-----------------------------------------------------|
 * | `chat`      | Chat (+ Vision if id contains `vision`)             |
 * | `image`     | Image                                               |
 * | `embedding` | Embeddings                                          |
 * | `code`      | Chat (code-focused, treated as regular chat for UI) |
 * | `rerank`    | None (not usable directly)                          |
 * | anything else | Chat (default)                                    |
 */
export const inferCapabilities = (model: TogetherModel): number => {
  const id = model.id.toLowerCase();
  if (model.type === "chat") {
    let caps = CapabilitiesUI.Chat;
    if (id.includes("vision")) caps |= CapabilitiesUI.Vision;
    return caps;
  }
  if (model.type === "image") return CapabilitiesUI.Image;
  if (model.type === "embedding") return CapabilitiesUI.Embeddings;
  if (model.type === "code") return CapabilitiesUI.Chat;
  if (model.type === "rerank") return CapabilitiesUI.None;
  return CapabilitiesUI.Chat;
};

/**
 * Fetch Together's model catalogue. Together doesn't expose `/models`
 * through the OpenAI SDK's shape — we hit the REST endpoint directly to
 * get each entry's `type`, which our capability inference depends on.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const response = await (creds.fetch ?? fetch)(`${creds.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${creds.apiKey}` },
  });
  if (!response.ok) return [];
  const models: TogetherModel[] = await response.json();

  return models.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "together" as const,
    capabilities: inferCapabilities(m),
  }));
};
