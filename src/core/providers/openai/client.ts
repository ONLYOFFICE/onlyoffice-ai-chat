import OpenAI from "openai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Placeholder API key fed to the SDK when none is configured. The OpenAI
 * SDK constructor throws `Missing credentials` on an empty `apiKey`
 * regardless of `baseURL`, so a dummy value is required just to build the
 * client. The accompanying `Authorization: null` default header below then
 * strips the bearer entirely, so keyless backends (vLLM, LM Studio,
 * Ollama, proxies) never see a bogus token.
 */
const PLACEHOLDER_API_KEY = "no-key";

/**
 * Build a configured OpenAI SDK client.
 *
 * `dangerouslyAllowBrowser` is enabled so the SDK stays silent about its
 * default "don't run in the browser" guard — a harmless no-op on the
 * server. HTTPS/TLS pooling is attached to the returned instance, so the
 * client should be reused across SDK calls for the lifetime of a request.
 *
 * @param creds - Base URL (required) and optional API key. With no key the
 *   client is built with a placeholder and the `Authorization` header is
 *   dropped entirely, so OpenAI-compatible endpoints that don't require
 *   auth work without ever receiving a bogus bearer token.
 * @returns A ready-to-use `OpenAI` client.
 */
export const createOpenAIClient = (creds: ProviderCredentials): OpenAI => {
  // Caller-supplied headers win over anything the SDK derives.
  const headers: Record<string, string | null> = { ...creds.headers };
  // No key and no explicit Authorization → strip the header entirely so the
  // SDK never sends the placeholder bearer (null deletes it).
  const hasAuthHeader = Object.keys(headers).some(
    (k) => k.toLowerCase() === "authorization"
  );
  if (!creds.apiKey && !hasAuthHeader) {
    headers.Authorization = null;
  }

  return new OpenAI({
    apiKey: creds.apiKey || PLACEHOLDER_API_KEY,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: true,
    ...(Object.keys(headers).length > 0 ? { defaultHeaders: headers } : {}),
    ...(creds.fetch ? { fetch: creds.fetch } : {}),
  });
};
