import OpenAI from "openai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Placeholder API key for OpenAI-compatible endpoints that don't require
 * authentication (local LLM servers, proxies — vLLM, LM Studio, Ollama,
 * …). The OpenAI SDK constructor throws `Missing credentials` on an empty
 * `apiKey` regardless of `baseURL`, so we feed it a dummy value when none
 * is configured. Such endpoints ignore the header; a genuine OpenAI
 * endpoint still rejects it with a 401, surfaced as a normal request error.
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
 * @param creds - Base URL (required) and optional API key. An empty key
 *   falls back to {@link PLACEHOLDER_API_KEY} so keyless compatible
 *   backends work without the SDK throwing at construction.
 * @returns A ready-to-use `OpenAI` client.
 */
export const createOpenAIClient = (creds: ProviderCredentials): OpenAI =>
  new OpenAI({
    apiKey: creds.apiKey || PLACEHOLDER_API_KEY,
    baseURL: creds.baseUrl,
    dangerouslyAllowBrowser: true,
    ...(creds.fetch ? { fetch: creds.fetch } : {}),
  });
