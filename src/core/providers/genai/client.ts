import { GoogleGenAI } from "@google/genai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Build a configured Google GenAI client.
 *
 * The GenAI SDK takes credentials via its `httpOptions.baseUrl` rather
 * than a `baseURL` field on the client, so this helper centralizes the
 * slightly different shape and normalizes a missing API key to an empty
 * string (GenAI requires a string).
 *
 * @param creds - Base URL and optional API key.
 * @returns A ready-to-use `GoogleGenAI` client.
 */
export const createGenAIClient = (creds: ProviderCredentials): GoogleGenAI =>
  new GoogleGenAI({
    apiKey: creds.apiKey ?? "",
    httpOptions: creds.baseUrl ? { baseUrl: creds.baseUrl } : undefined,
  });
