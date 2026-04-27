import Anthropic from "@anthropic-ai/sdk";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Build a configured Anthropic SDK client.
 *
 * `dangerouslyAllowBrowser` silences the SDK's default "don't run in the
 * browser" guard — a harmless no-op on the server. TLS pooling is
 * attached to the returned instance, so the client should be reused for
 * the lifetime of a request.
 *
 * @param creds - Base URL (required) and optional API key.
 * @returns A ready-to-use `Anthropic` client.
 */
export const createAnthropicClient = (
  creds: ProviderCredentials
): Anthropic =>
  new Anthropic({
    apiKey: creds.apiKey,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: true,
  });
