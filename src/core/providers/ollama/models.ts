import { createOpenAIClient } from "../openai/client";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";

/** Substitute key used when Ollama's local server doesn't require auth. */
const DUMMY_KEY = "ollama";

/** Build a throw-away SDK client pinned to Ollama's local URL. */
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
 * Validate the Ollama server by listing its models.
 *
 * Ollama doesn't require authentication, so an unreachable URL is the
 * only failure mode we care about.
 */
export const checkCredentials = async (
  creds: ProviderCredentials
): Promise<boolean | TErrorData> => {
  try {
    await client(creds).models.list();
    return true;
  } catch {
    return ProviderErrors.invalidUrl();
  }
};

/**
 * Fetch the list of locally-installed Ollama models.
 *
 * All Ollama models are flagged as Chat + Vision + Tools by default —
 * Ollama doesn't expose per-model capability metadata, and locally-run
 * models typically support the full feature set the UI might probe for.
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
    provider: "ollama" as const,
    capabilities: defaultCaps,
    ...(typeof m.created === "number" ? { created: m.created } : {}),
  }));
};
