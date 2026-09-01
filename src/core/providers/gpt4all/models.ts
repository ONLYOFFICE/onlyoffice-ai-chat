import { createOpenAIClient } from "../openai/client";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";
import { gpt4allInfo } from "./info";

/** Substitute key for GPT4All — the local server doesn't require auth. */
const DUMMY_KEY = "gpt4all";

const client = (creds: ProviderCredentials) =>
  // Shared factory keeps the host's `creds.fetch` proxy (a desktop
  // webview cannot reach http://localhost itself - Bug 81388) and the
  // extra headers; the dummy key stays the fallback bearer.
  createOpenAIClient({
    ...creds,
    baseUrl: creds.baseUrl || gpt4allInfo.baseUrl,
    apiKey: creds.apiKey || DUMMY_KEY,
  });

/**
 * Validate a GPT4All server by listing models.
 *
 * GPT4All runs locally and doesn't require auth, so any reachable
 * response is treated as success; any error maps to `invalidUrl`.
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
 * Fetch the locally-installed GPT4All model list.
 *
 * Errors propagate to the caller, exactly like the other keyless local
 * providers (Ollama, LM Studio): an unreachable server must be
 * distinguishable from a running server with an empty catalog (Bug
 * 83118). The widget surfaces the failure on the Base URL field, and
 * server hosts map it to 502.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  const response = (await client(creds).models.list()).data;
  const defaultCaps =
    CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;

  return response.map((m) => ({
    id: m.id,
    name: m.id,
    provider: "gpt4all" as const,
    capabilities: defaultCaps,
  }));
};
