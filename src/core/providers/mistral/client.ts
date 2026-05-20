import { HTTPClient, Mistral } from "@mistralai/mistralai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Build a configured Mistral SDK client.
 *
 * Mistral's SDK expects `serverURL` (not `baseURL`) and requires a
 * string `apiKey` — missing keys are normalized to an empty string.
 * When `creds.fetch` is set, every SDK call is routed through a custom
 * {@link HTTPClient} backed by that fetch.
 *
 * @param creds - Base URL and optional API key.
 * @returns A ready-to-use `Mistral` client.
 */
export const createMistralClient = (creds: ProviderCredentials): Mistral =>
  new Mistral({
    apiKey: creds.apiKey ?? "",
    serverURL: creds.baseUrl,
    ...(creds.fetch
      ? { httpClient: new HTTPClient({ fetcher: creds.fetch }) }
      : {}),
  });
