import OpenAI from "openai";
import { CapabilitiesUI } from "../../../shared/capabilities-ui";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import { ProviderErrors } from "../errors";
import { gpt4allInfo } from "./info";

/** Substitute key for GPT4All — the local server doesn't require auth. */
const DUMMY_KEY = "gpt4all";

const client = (baseUrl: string) =>
  new OpenAI({
    apiKey: DUMMY_KEY,
    baseURL: baseUrl || gpt4allInfo.baseUrl,
    dangerouslyAllowBrowser: true,
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
    await client(creds.baseUrl).models.list();
    return true;
  } catch {
    return ProviderErrors.invalidUrl();
  }
};

/**
 * Fetch the locally-installed GPT4All model list.
 *
 * Swallows errors and returns an empty list — the widget's UX expects a
 * silent empty state for GPT4All when the local server is stopped.
 */
export const listModels = async (
  creds: ProviderCredentials
): Promise<Model[]> => {
  try {
    const response = (await client(creds.baseUrl).models.list()).data;
    const defaultCaps =
      CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;

    return response.map((m) => ({
      id: m.id,
      name: m.id,
      provider: "gpt4all" as const,
      capabilities: defaultCaps,
    }));
  } catch {
    return [];
  }
};
