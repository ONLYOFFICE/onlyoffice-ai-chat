import { Mistral } from "@mistralai/mistralai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Build a configured Mistral SDK client.
 *
 * Mistral's SDK expects `serverURL` (not `baseURL`) and requires a
 * string `apiKey` — missing keys are normalized to an empty string.
 *
 * @param creds - Base URL and optional API key.
 * @returns A ready-to-use `Mistral` client.
 */
export const createMistralClient = (creds: ProviderCredentials): Mistral =>
  new Mistral({
    apiKey: creds.apiKey ?? "",
    serverURL: creds.baseUrl,
  });
