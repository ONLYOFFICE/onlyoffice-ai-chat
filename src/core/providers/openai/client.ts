import OpenAI from "openai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Build a configured OpenAI SDK client.
 *
 * `dangerouslyAllowBrowser` is enabled so the SDK stays silent about its
 * default "don't run in the browser" guard — a harmless no-op on the
 * server. HTTPS/TLS pooling is attached to the returned instance, so the
 * client should be reused across SDK calls for the lifetime of a request.
 *
 * @param creds - Base URL (required) and optional API key.
 * @returns A ready-to-use `OpenAI` client.
 */
export const createOpenAIClient = (creds: ProviderCredentials): OpenAI =>
  new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: true,
    ...(creds.fetch ? { fetch: creds.fetch } : {}),
  });
