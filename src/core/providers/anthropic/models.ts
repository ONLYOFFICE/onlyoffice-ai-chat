import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { createAnthropicClient } from "./client";
import { anthropicInfo } from "./info";

/**
 * Infer capabilities from an Anthropic model id.
 *
 * Anthropic's `/v1/models` exposes ids + display names but no capability
 * metadata, so we classify by id prefix:
 *
 * | id starts with / contains    | capabilities   |
 * |------------------------------|----------------|
 * | `claude-2`                   | Chat           |
 * | `claude-3-5-haiku`           | Chat           |
 * | everything else              | Chat + Vision  |
 *
 * @param id - Model id as returned by the Anthropic API.
 * @returns A bitmask from {@link CapabilitiesUI}.
 */
export const inferCapabilities = (id: string): number => {
  if (id.startsWith("claude-2")) return CapabilitiesUI.Chat;
  if (id.startsWith("claude-3-5-haiku")) return CapabilitiesUI.Chat;
  return CapabilitiesUI.Chat | CapabilitiesUI.Vision;
};

/**
 * Fetch all models from Anthropic, tagging reasoning-capable ids per
 * {@link anthropicInfo.thinkingModels} and decorating capabilities via
 * {@link inferCapabilities}.
 *
 * @param creds - Credentials used to create a throw-away SDK client.
 * @returns Array of {@link Model}.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const client = createAnthropicClient(creds);
  const { data: models } = await client.models.list();

  return models.map((m) => {
    // Anthropic reports an ISO `created_at` where the OpenAI-shaped
    // catalogues report Unix seconds — normalise to seconds so the model
    // picker can order every provider the same way. Proxies that omit or
    // mangle the field simply leave the model without a timestamp.
    const createdMs = m.created_at ? Date.parse(m.created_at) : NaN;

    return {
      // `display_name` is guaranteed by the real API, but OpenAI-compatible
      // proxies and test doubles serving `/v1/models` omit it — fall back to
      // the id so the model is still displayable (Bug 83119).
      id: m.id,
      name: m.display_name ?? m.id,
      provider: "anthropic" as const,
      reasoning: anthropicInfo.thinkingModels.some((t) => m.id.includes(t)),
      capabilities: inferCapabilities(m.id),
      ...(Number.isNaN(createdMs)
        ? {}
        : { created: Math.floor(createdMs / 1000) }),
    };
  });
};
