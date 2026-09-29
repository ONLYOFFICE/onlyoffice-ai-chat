import { createOpenAIClient } from "../openai/client";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";

/** Substitute key for LM Studio — the local server doesn't require auth. */
const DUMMY_KEY = "lm-studio";

const client = (creds: ProviderCredentials) =>
  // Shared factory keeps the host's `creds.fetch` proxy (a desktop
  // webview cannot reach http://localhost itself - Bug 81388) and the
  // extra headers; the dummy key stays the fallback bearer.
  createOpenAIClient({
    ...creds,
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey || DUMMY_KEY,
  });

/**
 * Validate an LM Studio server by listing models.
 *
 * LM Studio's local OpenAI-compatible server returns an empty list when
 * no models have been loaded through the UI — treat that case as an
 * invalid-URL condition (UX: "No models loaded in LM Studio").
 *
 * @param creds - Credentials with an LM Studio-style `baseUrl`.
 * @returns `true` if the server is reachable and has models loaded;
 *   otherwise a {@link TErrorData}.
 */
export const checkCredentials = async (
  creds: ProviderCredentials
): Promise<boolean | TErrorData> => {
  try {
    const response = await client(creds).models.list();
    if (!response.data || response.data.length === 0) {
      return ProviderErrors.invalidUrl("No models loaded in LM Studio");
    }
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to connect to LM Studio";
    return ProviderErrors.invalidUrl(message);
  }
};

/**
 * Fetch the currently-loaded LM Studio model list.
 *
 * All models get the broad default capability mask — LM Studio doesn't
 * expose per-model metadata, and locally-loaded models are usually
 * feature-complete for interactive use.
 *
 * @param creds - Credentials with an LM Studio-style `baseUrl`.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const response = await client(creds).models.list();
  const defaultCaps =
    CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;

  return response.data.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "lm-studio" as const,
    capabilities: defaultCaps,
    ...(typeof m.created === "number" ? { created: m.created } : {}),
  }));
};
